// Per-case insights derived from completed cells. A test case is "hard" if
// variants disagree on it — high spread = it distinguishes the leaders, low
// spread = every variant nails it (or fails it), which is less informative.

import type { CellKey, MatrixCell, RunMode, VariantSpec } from "./types";
import { cellKey } from "./types";

export interface CaseHardness {
  caseIndex: number;
  /** Score spread σ in absolute mode, win-rate max−min in arena mode. 0..∞ */
  spread: number;
  /** True if every variant has a usable signal for this case (not pending/errored). */
  complete: boolean;
}

export function rankCaseHardness(
  mode: RunMode,
  variants: VariantSpec[],
  caseCount: number,
  cells: Record<CellKey, MatrixCell>,
): CaseHardness[] {
  const out: CaseHardness[] = [];
  for (let ci = 0; ci < caseCount; ci++) {
    const values: number[] = [];
    let complete = true;
    for (const v of variants) {
      const c = cells[cellKey(v.id, ci)];
      const val = mode === "arena" ? c?.winRate : c?.score;
      if (typeof val !== "number") {
        complete = false;
        continue;
      }
      values.push(val);
    }
    if (values.length < 2) continue;
    const spread = mode === "arena" ? Math.max(...values) - Math.min(...values) : stddev(values);
    out.push({ caseIndex: ci, spread, complete });
  }
  return out.sort((a, b) => b.spread - a.spread);
}

function stddev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = xs.reduce((s, x) => s + x, 0) / xs.length;
  const v = xs.reduce((s, x) => s + (x - m) * (x - m), 0) / (xs.length - 1);
  return Math.sqrt(v);
}
