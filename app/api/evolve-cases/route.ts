// POST /api/evolve-cases — asks a model (through the Respan gateway) to propose
// new test cases that should discriminate the current variants on the judge
// criteria. Returns plain-text inputs the client appends to the test set.

import { NextResponse } from "next/server";
import { getEnv, EnvError } from "@/app/lib/env";
import { makeClient, errorMessage, withRespan } from "@/app/lib/respan";
import { MAX_CASES, type VariantSpec } from "@/app/lib/types";
import type { ChatCompletionCreateParamsNonStreaming } from "openai/resources/chat/completions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface EvolveCasesRequest {
  experimentId?: string;
  variants: VariantSpec[];
  cases: string[];
  judgeCriteria: string;
  model?: string;
  count?: number;
}

interface EvolveCasesResponse {
  cases: string[];
}

export async function POST(req: Request) {
  let body: EvolveCasesRequest;
  try {
    body = (await req.json()) as EvolveCasesRequest;
  } catch {
    return NextResponse.json({ error: "Body must be valid JSON." }, { status: 400 });
  }

  if (!body.judgeCriteria?.trim()) {
    return NextResponse.json({ error: "Need judge criteria to generate cases against." }, { status: 400 });
  }

  let env;
  try {
    env = getEnv();
  } catch (err) {
    if (err instanceof EnvError) return NextResponse.json({ error: err.message }, { status: 500 });
    throw err;
  }

  const model = body.model?.trim() || env.model;
  const headroom = MAX_CASES - (body.cases?.length ?? 0);
  const ask = Math.max(1, Math.min(body.count ?? 3, Math.max(1, headroom)));

  const client = makeClient(env);
  const system = [
    "You are an expert prompt evaluator. Given a judge criterion and a set of existing test cases,",
    "propose new test cases (single-line inputs) that would discriminate prompt variants better than the existing set.",
    "Prefer inputs that probe edge cases, ambiguity, common failure modes, or tricky reasoning.",
    "Reply with ONLY this JSON shape and nothing else:",
    '{"cases":["<case input 1>","<case input 2>",...]}',
  ].join(" ");

  const userParts = [
    `Judge criteria:\n${body.judgeCriteria.trim()}`,
    "",
    "Existing test cases:",
    ...(body.cases ?? []).map((c, i) => `${i + 1}. ${c}`),
  ];
  if (body.variants && body.variants.length > 0) {
    userParts.push(
      "",
      "Variants under test (so you can craft cases where they'd disagree):",
      ...body.variants.map((v, i) => `${i + 1}. ${v.name || `Variant ${i + 1}`}\n${v.prompt.trim().slice(0, 240)}`),
    );
  }
  userParts.push("", `Propose exactly ${ask} new test cases.`);

  const params = withRespan(
    {
      model,
      temperature: 0.8,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: userParts.join("\n") },
      ],
    } as ChatCompletionCreateParamsNonStreaming,
    {
      experimentId: body.experimentId ?? "evolve-cases",
      variant: "evolve-cases",
      caseIndex: 0,
      role: "judge",
      customerId: env.customerId,
    },
  );

  try {
    const res = await client.chat.completions.create(params);
    const raw = res.choices[0]?.message?.content ?? "";
    const parsed = parseEvolvedCases(raw, ask);
    if (parsed.cases.length === 0) {
      return NextResponse.json({ error: "Model did not return any usable cases." }, { status: 502 });
    }
    return NextResponse.json(parsed satisfies EvolveCasesResponse);
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 502 });
  }
}

function parseEvolvedCases(raw: string, limit: number): EvolveCasesResponse {
  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return { cases: [] };
    try {
      obj = JSON.parse(m[0]);
    } catch {
      return { cases: [] };
    }
  }
  if (!obj || typeof obj !== "object" || !("cases" in obj)) return { cases: [] };
  const arr = (obj as { cases?: unknown }).cases;
  if (!Array.isArray(arr)) return { cases: [] };
  const out: string[] = [];
  for (const item of arr) {
    const s = String(item ?? "").trim().replace(/\s+/g, " ");
    if (!s) continue;
    out.push(s.slice(0, 400));
    if (out.length >= limit) break;
  }
  return { cases: out };
}
