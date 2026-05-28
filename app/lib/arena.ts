// Arena scheduling: builds the pairwise battle plan (round-robin over variants,
// per case, with order swapping to cancel position bias) and aggregates the
// per-cell win rates used to color the matrix in arena mode.

import { cellKey, type BattleWinner, type CellKey } from "./types";

export interface BattleTask {
  caseIndex: number;
  /** Variant presented to the judge as "A". */
  firstId: string;
  /** Variant presented as "B". */
  secondId: string;
  /** Ensemble sample index (judges may be sampled more than once). */
  sample: number;
}

/** A resolved battle outcome, with the case it came from. */
export interface CaseBattle {
  caseIndex: number;
  a: string; // firstId
  b: string; // secondId
  winner: BattleWinner;
}

/**
 * Round-robin battles: every unordered pair, each case, both orderings (swap),
 * repeated `ensemble` times. Swapping cancels the judge's position bias.
 */
export function buildBattleTasks(ids: string[], caseCount: number, ensemble: number): BattleTask[] {
  const tasks: BattleTask[] = [];
  const samples = Math.max(1, ensemble);
  for (let ci = 0; ci < caseCount; ci++) {
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        for (let s = 0; s < samples; s++) {
          tasks.push({ caseIndex: ci, firstId: ids[i], secondId: ids[j], sample: s });
          // swapped ordering
          tasks.push({ caseIndex: ci, firstId: ids[j], secondId: ids[i], sample: s });
        }
      }
    }
  }
  return tasks;
}

/**
 * Per-cell win rate: for each (variant, case), wins / games across the battles
 * that variant fought in that case. Ties count as half a win.
 */
export function perCellWinRate(battles: CaseBattle[]): Record<CellKey, number> {
  const wins = new Map<CellKey, number>();
  const games = new Map<CellKey, number>();

  const bump = (map: Map<CellKey, number>, key: CellKey, by: number) =>
    map.set(key, (map.get(key) ?? 0) + by);

  for (const battle of battles) {
    const keyA = cellKey(battle.a, battle.caseIndex);
    const keyB = cellKey(battle.b, battle.caseIndex);
    bump(games, keyA, 1);
    bump(games, keyB, 1);
    if (battle.winner === "a") {
      bump(wins, keyA, 1);
    } else if (battle.winner === "b") {
      bump(wins, keyB, 1);
    } else {
      bump(wins, keyA, 0.5);
      bump(wins, keyB, 0.5);
    }
  }

  const out: Record<CellKey, number> = {};
  for (const [key, g] of games) {
    out[key] = g > 0 ? (wins.get(key) ?? 0) / g : 0;
  }
  return out;
}
