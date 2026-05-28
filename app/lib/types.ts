// Shared types for PromptArena. Types-only, safe to import from both the server
// route and client components.

import type { ArenaRating, MeanRating } from "./ratings";

export const INPUT_PLACEHOLDER = "{{input}}";

export const MIN_VARIANTS = 2;
export const MAX_VARIANTS = 5;
export const MAX_CASES = 8;
export const DEFAULT_CONCURRENCY = 4;
export const MAX_ENSEMBLE = 5;
/** Hard ceiling on total model calls per run, to bound cost. */
export const MAX_CALLS = 800;

/** Evaluation strategy. */
export type RunMode = "absolute" | "arena";

/** Which kind of call produced a given span. */
export type Role = "generate" | "judge" | "battle";

export interface VariantSpec {
  id: string;
  name: string;
  prompt: string;
  /** Optional per-variant model override. Empty/undefined falls back to the run model. */
  model?: string;
}

export interface RunRequest {
  experimentId: string;
  mode: RunMode;
  variants: VariantSpec[];
  cases: string[];
  judgeCriteria: string;
  model?: string;
  /** Optional model to judge with; defaults to the run model. */
  judgeModel?: string;
  concurrency?: number;
  /** Judge samples per evaluation (absolute) or per ordering (arena). */
  ensemble?: number;
}

export type BattleWinner = "a" | "b" | "tie";

// ---- Streamed NDJSON events ----

export interface MetricsSnapshot {
  elapsedMs: number;
  callsTotal: number;
  callsDone: number;
  inFlight: number;
  throughput: number; // completed calls per second
  p50: number; // latency ms
  p95: number; // latency ms
  tokens: number;
  costUsd: number;
  retries: number;
  cacheHits: number;
  errors: number;
}

export interface ArenaResult {
  mode: "arena";
  ratings: ArenaRating[];
  ids: string[];
  /** pairwise[i][j] = P(i beats j); null on the diagonal / unplayed. */
  pairwise: (number | null)[][];
  /** `${variantId}:${caseIndex}` -> win rate of that output across its battles. */
  perCellWinRate: Record<string, number>;
}

export interface AbsoluteResult {
  mode: "absolute";
  means: MeanRating[];
}

export type RunEvent =
  | {
      type: "run_start";
      experimentId: string;
      mode: RunMode;
      model: string;
      pricePer1k: number;
      totalCalls: number;
      variantCount: number;
      caseCount: number;
      /** Base URL of the Respan dashboard so the client can build deep links. */
      dashboardUrl: string;
    }
  | {
      type: "gen_done";
      variantId: string;
      caseIndex: number;
      output: string;
      latencyMs: number;
      tokens: number;
      cached: boolean;
    }
  | { type: "gen_token"; variantId: string; caseIndex: number; delta: string }
  | { type: "gen_error"; variantId: string; caseIndex: number; message: string }
  | {
      type: "score_done";
      variantId: string;
      caseIndex: number;
      score: number; // mean across ensemble samples
      stddev: number; // judge disagreement
      samples: number;
      latencyMs: number;
      tokens: number;
      reason: string;
    }
  | { type: "score_error"; variantId: string; caseIndex: number; message: string }
  | {
      type: "battle_done";
      caseIndex: number;
      a: string;
      b: string;
      winner: BattleWinner;
      latencyMs: number;
      tokens: number;
      reason: string;
    }
  | { type: "battle_error"; caseIndex: number; a: string; b: string; message: string }
  | { type: "metrics"; snapshot: MetricsSnapshot }
  | { type: "result"; result: ArenaResult | AbsoluteResult }
  | { type: "run_done"; completed: number; errored: number }
  | { type: "run_aborted"; completed: number };

/** `${variantId}:${caseIndex}` — key for a matrix cell. */
export type CellKey = `${string}:${number}`;

export function cellKey(variantId: string, caseIndex: number): CellKey {
  return `${variantId}:${caseIndex}`;
}

// ---- Persisted run history (shared between db.ts and the history UI) ----

export interface PersistedVariant {
  variantId: string;
  name: string;
  prompt: string;
  rank: number;
  /** Primary metric: Elo rating (arena) or mean score (absolute). */
  metric: number;
  ciLow: number | null;
  ciHigh: number | null;
  winRate: number | null;
  pRank1: number | null;
}

export interface PersistedRun {
  id: string;
  experimentId: string;
  createdAt: number;
  mode: RunMode;
  model: string;
  judgeCriteria: string;
  ensemble: number;
  variantCount: number;
  caseCount: number;
  totalCalls: number;
  costUsd: number;
  winnerName: string | null;
  winnerMetric: number | null;
  variants: PersistedVariant[];
}

// ---- Client-side matrix cell state (not sent over the wire) ----

export type CellPhase = "pending" | "running" | "done" | "error";

export interface MatrixCell {
  genStatus: CellPhase;
  output?: string;
  genError?: string;
  cached?: boolean;
  genLatencyMs?: number;
  genTokens?: number;
  /** Absolute mode. */
  scoreStatus?: CellPhase;
  score?: number;
  stddev?: number;
  samples?: number;
  reason?: string;
  scoreError?: string;
  judgeLatencyMs?: number;
  judgeTokens?: number;
  /** Arena mode: this output's win rate across its battles (from the result). */
  winRate?: number;
}
