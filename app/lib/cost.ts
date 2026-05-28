// Cost + call-count helpers. The pre-run figure is a deliberately rough estimate
// (token counts are unknown before calling); the post-run figure uses real usage.

import type { RunMode } from "./types";

export const ASSUMED_TOKENS_PER_CALL = 700;
export const DEFAULT_PRICE_PER_1K = 0.005;

export interface PlannedCalls {
  generate: number;
  evaluate: number;
  total: number;
}

function pairs(n: number): number {
  return (n * (n - 1)) / 2;
}

/** Worst-case model-call counts for a run (ignores cache hits). */
export function plannedCalls(
  mode: RunMode,
  variantCount: number,
  caseCount: number,
  ensemble: number,
): PlannedCalls {
  const generate = variantCount * caseCount;
  const e = Math.max(1, ensemble);
  const evaluate =
    mode === "arena"
      ? caseCount * pairs(variantCount) * 2 * e // both orderings (swap) × ensemble
      : variantCount * caseCount * e; // one judge per cell × ensemble
  return { generate, evaluate, total: generate + evaluate };
}

export interface RunEstimate {
  calls: number;
  estTokens: number;
  estUsd: number;
}

export function estimateRun(
  mode: RunMode,
  variantCount: number,
  caseCount: number,
  ensemble: number,
  pricePer1k: number = DEFAULT_PRICE_PER_1K,
): RunEstimate {
  const { total } = plannedCalls(mode, variantCount, caseCount, ensemble);
  const estTokens = total * ASSUMED_TOKENS_PER_CALL;
  return { calls: total, estTokens, estUsd: usdFromTokens(estTokens, pricePer1k) };
}

export function usdFromTokens(tokens: number, pricePer1k: number): number {
  return (tokens / 1000) * pricePer1k;
}

export function formatUsd(usd: number): string {
  if (usd === 0) return "$0.00";
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}
