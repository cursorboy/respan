// Pairwise rating engine for the arena. Turns head-to-head battle outcomes into
// rankings with statistical confidence, the way LMSYS Chatbot Arena ranks models.
//
// - Bradley-Terry (order-independent MLE via the MM algorithm) is the primary
//   ranking. Strengths are mapped to a familiar Elo scale for display.
// - Elo (sequential) is provided for comparison.
// - A bootstrap over battles yields confidence intervals and P(rank 1), which is
//   what tells you whether the winner is real or noise.

import { mean, mulberry32, percentile, resampleIndices } from "./stats";

export interface Battle {
  a: string; // variantId
  b: string; // variantId
  winner: "a" | "b" | "tie";
}

const ELO_BASE = 1500;
// 400 / ln(10): maps a Bradley-Terry log-strength difference to Elo points so
// a 400-point gap means ~10:1 odds, the usual Elo convention.
const ELO_SCALE = 400 / Math.LN10;

export interface WinMatrix {
  ids: string[];
  /** wins[i][j] = times i beat j (ties contribute 0.5 to each side). */
  wins: number[][];
  /** games[i][j] = total games played between i and j (symmetric). */
  games: number[][];
}

export function aggregateWinMatrix(battles: Battle[], ids: string[]): WinMatrix {
  const index = new Map(ids.map((id, i) => [id, i]));
  const n = ids.length;
  const wins = Array.from({ length: n }, () => new Array(n).fill(0));
  const games = Array.from({ length: n }, () => new Array(n).fill(0));

  for (const battle of battles) {
    const i = index.get(battle.a);
    const j = index.get(battle.b);
    if (i === undefined || j === undefined || i === j) continue;
    games[i][j] += 1;
    games[j][i] += 1;
    if (battle.winner === "a") {
      wins[i][j] += 1;
    } else if (battle.winner === "b") {
      wins[j][i] += 1;
    } else {
      wins[i][j] += 0.5;
      wins[j][i] += 0.5;
    }
  }
  return { ids, wins, games };
}

/**
 * Fit Bradley-Terry strengths via the minorization-maximization algorithm.
 * `smoothing` adds a symmetric pseudo-count to every played pair so that an
 * all-wins or all-losses variant still gets a finite strength. Strengths are
 * normalized to geometric mean 1.
 */
export function fitBradleyTerry(
  matrix: WinMatrix,
  { maxIter = 200, tol = 1e-9, smoothing = 0.25 }: { maxIter?: number; tol?: number; smoothing?: number } = {},
): number[] {
  const n = matrix.ids.length;
  if (n === 0) return [];
  if (n === 1) return [1];

  // Apply smoothing to played pairs.
  const wins = matrix.wins.map((row) => row.slice());
  const games = matrix.games.map((row) => row.slice());
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (games[i][j] > 0) {
        wins[i][j] += smoothing;
        wins[j][i] += smoothing;
        games[i][j] += 2 * smoothing;
        games[j][i] += 2 * smoothing;
      }
    }
  }

  const totalWins = wins.map((row) => row.reduce((s, w) => s + w, 0));
  let p = new Array(n).fill(1);

  for (let iter = 0; iter < maxIter; iter++) {
    const next = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      let denom = 0;
      for (let j = 0; j < n; j++) {
        if (i === j || games[i][j] === 0) continue;
        denom += games[i][j] / (p[i] + p[j]);
      }
      next[i] = denom > 0 ? totalWins[i] / denom : p[i];
    }
    // Normalize to geometric mean 1 for numerical stability.
    const logMean = mean(next.map((x) => Math.log(Math.max(x, 1e-12))));
    const norm = Math.exp(logMean);
    for (let i = 0; i < n; i++) next[i] /= norm;

    let delta = 0;
    for (let i = 0; i < n; i++) delta = Math.max(delta, Math.abs(next[i] - p[i]));
    p = next;
    if (delta < tol) break;
  }
  return p;
}

/** Map Bradley-Terry strengths (geomean 1) to Elo-scale ratings centered at 1500. */
export function strengthsToElo(strengths: number[]): number[] {
  return strengths.map((s) => ELO_BASE + ELO_SCALE * Math.log(Math.max(s, 1e-12)));
}

/** Sequential Elo, for comparison with the order-independent Bradley-Terry fit. */
export function computeElo(
  battles: Battle[],
  ids: string[],
  { k = 32, base = ELO_BASE }: { k?: number; base?: number } = {},
): Map<string, number> {
  const rating = new Map(ids.map((id) => [id, base]));
  for (const battle of battles) {
    const ra = rating.get(battle.a);
    const rb = rating.get(battle.b);
    if (ra === undefined || rb === undefined) continue;
    const ea = 1 / (1 + 10 ** ((rb - ra) / 400));
    const sa = battle.winner === "a" ? 1 : battle.winner === "tie" ? 0.5 : 0;
    rating.set(battle.a, ra + k * (sa - ea));
    rating.set(battle.b, rb + k * (1 - sa - (1 - ea)));
  }
  return rating;
}

/** Overall win rate per variant (wins / games), ties as half wins. */
export function overallWinRates(matrix: WinMatrix): number[] {
  return matrix.ids.map((_, i) => {
    let w = 0;
    let g = 0;
    for (let j = 0; j < matrix.ids.length; j++) {
      if (i === j) continue;
      w += matrix.wins[i][j];
      g += matrix.games[i][j];
    }
    return g > 0 ? w / g : 0;
  });
}

/** Pairwise win-rate matrix for the heatmap: rate[i][j] = P(i beats j). */
export function pairwiseWinRates(matrix: WinMatrix): number[][] {
  const n = matrix.ids.length;
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => {
      if (i === j || matrix.games[i][j] === 0) return NaN;
      return matrix.wins[i][j] / matrix.games[i][j];
    }),
  );
}

export interface ArenaRating {
  variantId: string;
  rating: number; // Elo-scale point estimate (Bradley-Terry)
  ciLow: number;
  ciHigh: number;
  winRate: number;
  /** Fraction of bootstrap resamples in which this variant had the top rating. */
  pRank1: number;
}

/**
 * Bootstrap the arena: resample battles with replacement, refit Bradley-Terry,
 * and summarize each variant's rating distribution. Deterministic given `seed`.
 */
export function bootstrapArena(
  battles: Battle[],
  ids: string[],
  { iterations = 500, seed = 1, ciLevel = 0.95 }: { iterations?: number; seed?: number; ciLevel?: number } = {},
): ArenaRating[] {
  const n = ids.length;
  const point = strengthsToElo(fitBradleyTerry(aggregateWinMatrix(battles, ids)));
  const winRate = overallWinRates(aggregateWinMatrix(battles, ids));

  const samples: number[][] = Array.from({ length: n }, () => []);
  const rank1Count = new Array(n).fill(0);

  if (battles.length > 0) {
    const rng = mulberry32(seed);
    for (let it = 0; it < iterations; it++) {
      const idx = resampleIndices(battles.length, rng);
      const resampled = idx.map((k) => battles[k]);
      const ratings = strengthsToElo(fitBradleyTerry(aggregateWinMatrix(resampled, ids)));
      let bestIdx = 0;
      for (let i = 0; i < n; i++) {
        samples[i].push(ratings[i]);
        if (ratings[i] > ratings[bestIdx]) bestIdx = i;
      }
      rank1Count[bestIdx]++;
    }
  }

  const loP = ((1 - ciLevel) / 2) * 100;
  const hiP = (1 - (1 - ciLevel) / 2) * 100;

  return ids.map((variantId, i) => ({
    variantId,
    rating: point[i] ?? ELO_BASE,
    ciLow: samples[i].length ? percentile(samples[i], loP) : (point[i] ?? ELO_BASE),
    ciHigh: samples[i].length ? percentile(samples[i], hiP) : (point[i] ?? ELO_BASE),
    winRate: winRate[i] ?? 0,
    pRank1: battles.length > 0 ? rank1Count[i] / iterations : 0,
  }));
}

export interface MeanRating {
  variantId: string;
  mean: number;
  ciLow: number;
  ciHigh: number;
}

/**
 * Bootstrap the mean score per variant (for absolute/ensemble mode). `scores`
 * maps variantId -> per-case scores. Resamples cases with replacement.
 */
export function bootstrapMeans(
  scores: Record<string, number[]>,
  { iterations = 500, seed = 1, ciLevel = 0.95 }: { iterations?: number; seed?: number; ciLevel?: number } = {},
): MeanRating[] {
  const loP = ((1 - ciLevel) / 2) * 100;
  const hiP = (1 - (1 - ciLevel) / 2) * 100;
  const rng = mulberry32(seed);

  return Object.entries(scores).map(([variantId, values]) => {
    if (values.length === 0) {
      return { variantId, mean: 0, ciLow: 0, ciHigh: 0 };
    }
    const point = mean(values);
    const means: number[] = [];
    for (let it = 0; it < iterations; it++) {
      const idx = resampleIndices(values.length, rng);
      means.push(mean(idx.map((k) => values[k])));
    }
    return {
      variantId,
      mean: point,
      ciLow: percentile(means, loP),
      ciHigh: percentile(means, hiP),
    };
  });
}
