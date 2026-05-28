// Last-run persistence via localStorage: config + most recent run's results +
// metrics, restored across refreshes (P1). Not cross-machine shareable.

import type {
  AbsoluteResult,
  ArenaResult,
  CellKey,
  MatrixCell,
  MetricsSnapshot,
  RunMode,
  VariantSpec,
} from "./types";

const KEY = "promptarena.state.v2";

export interface PersistedState {
  variants: VariantSpec[];
  casesText: string;
  judgeCriteria: string;
  mode: RunMode;
  ensemble: number;
  cells: Record<CellKey, MatrixCell>;
  result: ArenaResult | AbsoluteResult | null;
  metrics: MetricsSnapshot | null;
  experimentId: string;
  model: string;
  pricePer1k: number;
  ts: number;
}

export function loadState(): PersistedState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PersistedState) : null;
  } catch {
    return null;
  }
}

export function saveState(state: PersistedState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* quota / disabled — best-effort */
  }
}
