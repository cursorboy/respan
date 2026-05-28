// GET /api/cost?experimentId=... — pulls the actual billed cost of an experiment
// from Respan's Filters API instead of the local price-per-1k estimate.
//
// Filters API (POST https://api.respan.ai/api/traces/list/) returns every span
// tagged with the given experiment_id; we sum `cost` and `total_tokens` and
// break down by `metadata.variant` so the UI can show per-variant spend too.
//
// Note: spans are eventually-consistent — a fresh run may not be queryable for
// a few seconds. The client retries; we don't here.

import { NextResponse } from "next/server";
import { getEnv, EnvError } from "@/app/lib/env";
import { errorMessage } from "@/app/lib/respan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RespanSpan {
  cost?: number;
  total_tokens?: number;
  metadata?: Record<string, string> | null;
}

export interface CostResponse {
  costUsd: number;
  tokens: number;
  requestCount: number;
  byVariant: Record<string, { costUsd: number; tokens: number; count: number }>;
  /** False if the Filters API returned zero spans (not yet ingested or wrong id). */
  found: boolean;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const experimentId = url.searchParams.get("experimentId")?.trim();
  if (!experimentId) return NextResponse.json({ error: "experimentId is required." }, { status: 400 });

  let env;
  try {
    env = getEnv();
  } catch (err) {
    if (err instanceof EnvError) return NextResponse.json({ error: err.message }, { status: 500 });
    throw err;
  }

  // baseUrl is the gateway root, e.g. "https://api.respan.ai/api"; the Filters
  // API lives directly under it as /traces/list/.
  const base = env.baseUrl.replace(/\/+$/, "");
  const filtersUrl = `${base}/traces/list/?page_size=1000`;

  try {
    const res = await fetch(filtersUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filters: {
          // Empty operator means equality per Respan's filter operator list.
          metadata__experiment_id: { operator: "", value: [experimentId] },
        },
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json(
        { error: `Filters API ${res.status}: ${text.slice(0, 240)}` },
        { status: 502 },
      );
    }
    const data: unknown = await res.json();
    // Accept either Django REST {results:[]} or {data:[]} envelopes defensively.
    const spans: RespanSpan[] = Array.isArray((data as { results?: unknown }).results)
      ? ((data as { results: RespanSpan[] }).results)
      : Array.isArray((data as { data?: unknown }).data)
        ? ((data as { data: RespanSpan[] }).data)
        : [];

    let costUsd = 0;
    let tokens = 0;
    const byVariant: Record<string, { costUsd: number; tokens: number; count: number }> = {};
    for (const s of spans) {
      const c = typeof s.cost === "number" ? s.cost : 0;
      const t = typeof s.total_tokens === "number" ? s.total_tokens : 0;
      costUsd += c;
      tokens += t;
      const v = s.metadata?.variant ?? "unknown";
      if (!byVariant[v]) byVariant[v] = { costUsd: 0, tokens: 0, count: 0 };
      byVariant[v].costUsd += c;
      byVariant[v].tokens += t;
      byVariant[v].count += 1;
    }
    const body: CostResponse = {
      costUsd,
      tokens,
      requestCount: spans.length,
      byVariant,
      found: spans.length > 0,
    };
    return NextResponse.json(body);
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 502 });
  }
}
