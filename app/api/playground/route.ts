// POST /api/playground — fire a single gateway call and return output + usage.
// Supports an inline prompt OR a managed Respan prompt referenced by id (with
// variables), which is the Respan-specific path. Every call is a span.

import type { ChatCompletionCreateParamsNonStreaming } from "openai/resources/chat/completions";
import { getEnv, EnvError } from "@/app/lib/env";
import { makeClient, withRespan, errorMessage } from "@/app/lib/respan";
import { withRetry } from "@/app/lib/retry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  source?: "inline" | "managed";
  prompt?: string;
  input?: string;
  promptId?: string;
  version?: number | string;
  model?: string;
}

export async function POST(req: Request): Promise<Response> {
  let env;
  try {
    env = getEnv();
  } catch (err) {
    return Response.json({ error: err instanceof EnvError ? err.message : errorMessage(err) }, { status: 500 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const client = makeClient(env);
  const model = body.model?.trim() || env.model;
  const input = body.input ?? "";
  const managed = body.source === "managed";

  if (managed && !body.promptId?.trim()) {
    return Response.json({ error: "Enter a Respan prompt id." }, { status: 400 });
  }
  if (!managed && !body.prompt?.trim()) {
    return Response.json({ error: "Enter a prompt." }, { status: 400 });
  }

  // Inline: a normal user message. Managed: reference the deployed prompt by id;
  // the gateway renders its messages, we just pass variables.
  const base: Record<string, unknown> = managed
    ? {
        model,
        messages: [],
        prompt: {
          prompt_id: body.promptId!.trim(),
          variables: { input },
          ...(body.version !== undefined && body.version !== "" ? { version: body.version } : {}),
        },
      }
    : {
        model,
        messages: [{ role: "user", content: body.prompt!.split("{{input}}").join(input) }],
      };

  const params = withRespan(base as unknown as ChatCompletionCreateParamsNonStreaming, {
    experimentId: `playground-${Date.now()}`,
    variant: "playground",
    caseIndex: 0,
    role: "generate",
    customerId: env.customerId,
  });

  const signal = req.signal;
  try {
    const t0 = performance.now();
    const res = await withRetry(() => client.chat.completions.create(params, { signal }), { signal, retries: 2 });
    const latencyMs = Math.round(performance.now() - t0);
    return Response.json({
      output: res.choices[0]?.message?.content ?? "",
      tokens: res.usage?.total_tokens ?? 0,
      latencyMs,
      model,
    });
  } catch (err) {
    return Response.json({ error: errorMessage(err) }, { status: 502 });
  }
}
