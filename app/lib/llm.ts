// Central model-call wrapper: content-addressed cache → retry/backoff → metrics,
// in one place. Both generation and judging go through this so caching, retries,
// and observability are uniform.

import "server-only";
import type OpenAI from "openai";
import type {
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionMessageParam,
} from "openai/resources/chat/completions";
import type { Stream } from "openai/streaming";
import type { ChatCompletionChunk } from "openai/resources/chat/completions";
import { withRespan, type RespanTag } from "./respan";
import { withRetry } from "./retry";
import { cacheGet, cacheSet, cacheKey } from "./cache";
import type { MetricsAggregator } from "./metrics";

export interface CallResult {
  output: string;
  tokens: number;
  latencyMs: number;
  cached: boolean;
}

export async function callModel(
  client: OpenAI,
  opts: {
    model: string;
    messages: ChatCompletionMessageParam[];
    temperature?: number;
    responseFormatJson?: boolean;
    tag: RespanTag;
    signal: AbortSignal;
    metrics: MetricsAggregator;
  },
): Promise<CallResult> {
  const temperature = opts.temperature ?? 0;
  // Only deterministic calls are safe to cache.
  const cacheable = temperature === 0;
  const key = cacheable ? cacheKey(opts.model, temperature, opts.messages) : "";

  if (cacheable) {
    const hit = cacheGet(key);
    if (hit) {
      opts.metrics.cacheHit(hit.tokens);
      return { output: hit.output, tokens: hit.tokens, latencyMs: 0, cached: true };
    }
  }

  const params = withRespan(
    {
      model: opts.model,
      messages: opts.messages,
      temperature,
      ...(opts.responseFormatJson ? { response_format: { type: "json_object" } } : {}),
    } as ChatCompletionCreateParamsNonStreaming,
    opts.tag,
  );

  opts.metrics.startCall();
  const t0 = performance.now();
  try {
    const res = await withRetry(
      () => client.chat.completions.create(params, { signal: opts.signal }),
      { signal: opts.signal, onRetry: () => opts.metrics.recordRetry() },
    );
    const latencyMs = Math.round(performance.now() - t0);
    const output = res.choices[0]?.message?.content ?? "";
    const tokens = res.usage?.total_tokens ?? 0;
    opts.metrics.endCall(latencyMs, tokens);
    if (cacheable) cacheSet(key, { output, tokens });
    return { output, tokens, latencyMs, cached: false };
  } catch (err) {
    opts.metrics.failCall();
    throw err;
  }
}

/**
 * Streaming version of {@link callModel}. Emits each delta through `onDelta` as
 * the gateway streams it, accumulates the full content, and returns the same
 * shape so callers can downgrade gracefully. Skips retry (mid-stream retry is
 * ambiguous); cache hits replay the cached output through `onDelta` as a single
 * chunk so the UI gets a consistent experience either way.
 */
export async function callModelStream(
  client: OpenAI,
  opts: {
    model: string;
    messages: ChatCompletionMessageParam[];
    temperature?: number;
    tag: RespanTag;
    signal: AbortSignal;
    metrics: MetricsAggregator;
    onDelta: (text: string) => void;
  },
): Promise<CallResult> {
  const temperature = opts.temperature ?? 0;
  const cacheable = temperature === 0;
  const key = cacheable ? cacheKey(opts.model, temperature, opts.messages) : "";

  if (cacheable) {
    const hit = cacheGet(key);
    if (hit) {
      opts.metrics.cacheHit(hit.tokens);
      if (hit.output) opts.onDelta(hit.output);
      return { output: hit.output, tokens: hit.tokens, latencyMs: 0, cached: true };
    }
  }

  // OpenAI's typed overloads pick streaming when `stream: true`; the Respan
  // wrapper expects the non-streaming params type, so we widen at the call site.
  const params = withRespan(
    {
      model: opts.model,
      messages: opts.messages,
      temperature,
      stream: true,
      stream_options: { include_usage: true },
    } as unknown as ChatCompletionCreateParamsNonStreaming,
    opts.tag,
  );

  opts.metrics.startCall();
  const t0 = performance.now();
  let output = "";
  let tokens = 0;
  try {
    const stream = (await client.chat.completions.create(
      params as unknown as ChatCompletionCreateParamsNonStreaming,
      { signal: opts.signal },
    )) as unknown as Stream<ChatCompletionChunk>;
    for await (const chunk of stream) {
      if (opts.signal.aborted) break;
      const delta = chunk.choices?.[0]?.delta?.content;
      if (delta) {
        output += delta;
        opts.onDelta(delta);
      }
      if (chunk.usage?.total_tokens) tokens = chunk.usage.total_tokens;
    }
    if (!tokens) tokens = Math.ceil(output.length / 4); // estimate when gateway omits usage
    const latencyMs = Math.round(performance.now() - t0);
    opts.metrics.endCall(latencyMs, tokens);
    if (cacheable) cacheSet(key, { output, tokens });
    return { output, tokens, latencyMs, cached: false };
  } catch (err) {
    opts.metrics.failCall();
    throw err;
  }
}
