// POST /api/evolve — asks a model (through the Respan gateway) to propose
// substantially better prompt variants given the current set, the judge
// criteria, and a sample of test cases. Returns 2-3 new {name, prompt} objects
// the client can append to its variants list. Self-improving loop closer.

import { NextResponse } from "next/server";
import { getEnv, EnvError } from "@/app/lib/env";
import { makeClient, errorMessage, withRespan } from "@/app/lib/respan";
import { INPUT_PLACEHOLDER, MAX_VARIANTS, type VariantSpec } from "@/app/lib/types";
import type { ChatCompletionCreateParamsNonStreaming } from "openai/resources/chat/completions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface EvolveRequest {
  experimentId?: string;
  variants: VariantSpec[];
  cases: string[];
  judgeCriteria: string;
  /** Optional override; otherwise uses env model. */
  model?: string;
  /** How many new variants to propose; clamped to fit MAX_VARIANTS. */
  count?: number;
}

interface EvolveResponse {
  variants: { name: string; prompt: string }[];
}

export async function POST(req: Request) {
  let body: EvolveRequest;
  try {
    body = (await req.json()) as EvolveRequest;
  } catch {
    return NextResponse.json({ error: "Body must be valid JSON." }, { status: 400 });
  }

  if (!Array.isArray(body.variants) || body.variants.length === 0) {
    return NextResponse.json({ error: "Need existing variants to learn from." }, { status: 400 });
  }
  if (!body.judgeCriteria?.trim()) {
    return NextResponse.json({ error: "Need judge criteria to evolve against." }, { status: 400 });
  }

  let env;
  try {
    env = getEnv();
  } catch (err) {
    if (err instanceof EnvError) return NextResponse.json({ error: err.message }, { status: 500 });
    throw err;
  }

  const model = body.model?.trim() || env.model;
  const headroom = MAX_VARIANTS - body.variants.length;
  const ask = Math.max(1, Math.min(body.count ?? 2, Math.max(1, headroom)));

  const client = makeClient(env);
  const system = [
    "You are an expert prompt engineer. Given existing prompt variants and the judge criteria they will be scored on,",
    "propose substantially better variants that should outperform the existing ones on the criteria.",
    `Each new prompt MUST include the literal token ${INPUT_PLACEHOLDER} where the test input goes.`,
    "Make each new variant meaningfully different from the existing ones (different strategy, structure, or framing).",
    "Reply with ONLY this JSON shape and nothing else:",
    '{"variants":[{"name":"<5-word label>","prompt":"<full prompt template>"}]}',
  ].join(" ");

  const userParts = [
    `Judge criteria:\n${body.judgeCriteria.trim()}`,
    "",
    "Existing variants:",
    ...body.variants.map((v, i) => `${i + 1}. ${v.name || `Variant ${i + 1}`}\n${v.prompt.trim()}`),
  ];
  if (body.cases && body.cases.length > 0) {
    userParts.push("", "Sample test inputs:", ...body.cases.slice(0, 4).map((c, i) => `(${i + 1}) ${c}`));
  }
  userParts.push("", `Propose exactly ${ask} new variants.`);

  const params = withRespan(
    {
      model,
      temperature: 0.7, // creative — divergence helps
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: userParts.join("\n") },
      ],
    } as ChatCompletionCreateParamsNonStreaming,
    {
      experimentId: body.experimentId ?? "evolve",
      variant: "evolve",
      caseIndex: 0,
      role: "judge", // closest reserved role; spans still tag as evolve via experimentId
      customerId: env.customerId,
    },
  );

  try {
    const res = await client.chat.completions.create(params);
    const raw = res.choices[0]?.message?.content ?? "";
    const parsed = parseEvolved(raw, ask);
    if (parsed.variants.length === 0) {
      return NextResponse.json({ error: "Model did not return any usable variants." }, { status: 502 });
    }
    return NextResponse.json(parsed satisfies EvolveResponse);
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 502 });
  }
}

function parseEvolved(raw: string, limit: number): EvolveResponse {
  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return { variants: [] };
    try {
      obj = JSON.parse(m[0]);
    } catch {
      return { variants: [] };
    }
  }
  if (!obj || typeof obj !== "object" || !("variants" in obj)) return { variants: [] };
  const arr = (obj as { variants?: unknown }).variants;
  if (!Array.isArray(arr)) return { variants: [] };
  const out: { name: string; prompt: string }[] = [];
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const name = String((item as Record<string, unknown>).name ?? "").trim() || `Evolved ${out.length + 1}`;
    const prompt = String((item as Record<string, unknown>).prompt ?? "").trim();
    if (!prompt || !prompt.includes(INPUT_PLACEHOLDER)) continue;
    out.push({ name: name.slice(0, 60), prompt });
    if (out.length >= limit) break;
  }
  return { variants: out };
}
