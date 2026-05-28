// Server-only: builds the OpenAI client pointed at the Respan gateway, and
// attaches Respan observability tags to a chat-completions request.
//
// Respan is OpenAI-compatible. Custom fields (`customer_identifier`) ride in
// the request body and are forwarded verbatim by the Node SDK. Plain OpenAI
// servers ignore unknown fields, so the tagging degrades gracefully. We attach
// it in exactly one place so the contract lives in a single file.

import "server-only";
import OpenAI from "openai";
import type { ChatCompletionCreateParamsNonStreaming } from "openai/resources/chat/completions";
import type { Env } from "./env";
import type { Role } from "./types";

export function makeClient(env: Env): OpenAI {
  return new OpenAI({
    apiKey: env.apiKey,
    baseURL: env.baseUrl,
    // We run our own retry/backoff layer (lib/retry.ts) so retry counts surface
    // in metrics; disable the SDK's built-in retries to avoid stacking them.
    maxRetries: 0,
  });
}

export interface RespanTag {
  experimentId: string;
  variant: string;
  caseIndex: number;
  role: Role;
  customerId: string;
}

/**
 * Returns the params with Respan metadata + customer_identifier attached.
 * `metadata` is a typed field (string values only), which is why caseIndex is
 * stringified. `customer_identifier` is a Respan extension, forwarded as-is via
 * the cast.
 */
export function withRespan(
  params: ChatCompletionCreateParamsNonStreaming,
  tag: RespanTag,
): ChatCompletionCreateParamsNonStreaming {
  return {
    ...params,
    metadata: {
      experiment_id: tag.experimentId,
      variant: tag.variant,
      case_index: String(tag.caseIndex),
      role: tag.role,
    },
    customer_identifier: tag.customerId,
  } as ChatCompletionCreateParamsNonStreaming;
}

/** Pulls the most useful message out of whatever the gateway/SDK threw. */
export function errorMessage(err: unknown): string {
  if (err instanceof OpenAI.APIError) {
    // The gateway's own message (e.g. "model not enabled", "insufficient credits").
    return err.message || `Gateway error (status ${err.status ?? "unknown"})`;
  }
  if (err instanceof Error) return err.message;
  return String(err);
}
