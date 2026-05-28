import { describe, it, expect } from "vitest";
import {
  aggregateWinMatrix,
  bootstrapArena,
  bootstrapMeans,
  computeElo,
  fitBradleyTerry,
  overallWinRates,
  pairwiseWinRates,
  strengthsToElo,
  type Battle,
} from "../ratings";

const IDS = ["A", "B", "C"];

// A clear ordering A > B > C: each higher variant beats each lower one every round.
function dominanceBattles(rounds = 6): Battle[] {
  const out: Battle[] = [];
  for (let r = 0; r < rounds; r++) {
    out.push({ a: "A", b: "B", winner: "a" });
    out.push({ a: "A", b: "C", winner: "a" });
    out.push({ a: "B", b: "C", winner: "a" });
  }
  return out;
}

describe("aggregateWinMatrix", () => {
  it("counts wins, losses, and ties", () => {
    const battles: Battle[] = [
      { a: "A", b: "B", winner: "a" },
      { a: "A", b: "B", winner: "b" },
      { a: "A", b: "B", winner: "tie" },
    ];
    const m = aggregateWinMatrix(battles, ["A", "B"]);
    expect(m.games[0][1]).toBe(3);
    expect(m.wins[0][1]).toBe(1.5); // 1 win + 0.5 tie
    expect(m.wins[1][0]).toBe(1.5);
  });

  it("ignores unknown ids and self-pairs", () => {
    const m = aggregateWinMatrix([{ a: "A", b: "Z", winner: "a" }], ["A", "B"]);
    expect(m.games[0][1]).toBe(0);
  });
});

describe("fitBradleyTerry + strengthsToElo", () => {
  it("ranks a dominant variant highest and a dominated one lowest", () => {
    const m = aggregateWinMatrix(dominanceBattles(), IDS);
    const ratings = strengthsToElo(fitBradleyTerry(m));
    const [rA, rB, rC] = ratings;
    expect(rA).toBeGreaterThan(rB);
    expect(rB).toBeGreaterThan(rC);
  });

  it("gives equal ratings (~1500) when everyone ties", () => {
    const battles: Battle[] = [
      { a: "A", b: "B", winner: "tie" },
      { a: "A", b: "C", winner: "tie" },
      { a: "B", b: "C", winner: "tie" },
    ];
    const ratings = strengthsToElo(fitBradleyTerry(aggregateWinMatrix(battles, IDS)));
    for (const r of ratings) expect(r).toBeCloseTo(1500, 3);
  });

  it("is order-independent (shuffling battles gives the same fit)", () => {
    const battles = dominanceBattles();
    const forward = strengthsToElo(fitBradleyTerry(aggregateWinMatrix(battles, IDS)));
    const reversed = strengthsToElo(
      fitBradleyTerry(aggregateWinMatrix([...battles].reverse(), IDS)),
    );
    for (let i = 0; i < forward.length; i++) {
      expect(forward[i]).toBeCloseTo(reversed[i], 6);
    }
  });

  it("handles a single variant", () => {
    expect(fitBradleyTerry(aggregateWinMatrix([], ["A"]))).toEqual([1]);
  });
});

describe("computeElo", () => {
  it("moves the winner up and the loser down", () => {
    const ratings = computeElo([{ a: "A", b: "B", winner: "a" }], ["A", "B"]);
    expect(ratings.get("A")!).toBeGreaterThan(1500);
    expect(ratings.get("B")!).toBeLessThan(1500);
  });

  it("ranks the dominant variant on top", () => {
    const ratings = computeElo(dominanceBattles(), IDS);
    expect(ratings.get("A")!).toBeGreaterThan(ratings.get("B")!);
    expect(ratings.get("B")!).toBeGreaterThan(ratings.get("C")!);
  });
});

describe("win rates", () => {
  it("overall win rate is 1 for a total winner, 0 for a total loser", () => {
    const m = aggregateWinMatrix(dominanceBattles(), IDS);
    const rates = overallWinRates(m);
    expect(rates[0]).toBeCloseTo(1, 6); // A wins all
    expect(rates[2]).toBeCloseTo(0, 6); // C loses all
  });

  it("pairwise matrix has NaN on the diagonal and correct off-diagonal", () => {
    const m = aggregateWinMatrix(dominanceBattles(), IDS);
    const pw = pairwiseWinRates(m);
    expect(Number.isNaN(pw[0][0])).toBe(true);
    expect(pw[0][1]).toBeCloseTo(1, 6); // A beats B every time
    expect(pw[1][0]).toBeCloseTo(0, 6);
  });
});

describe("bootstrapArena", () => {
  it("is deterministic given a seed", () => {
    const battles = dominanceBattles();
    const a = bootstrapArena(battles, IDS, { iterations: 200, seed: 11 });
    const b = bootstrapArena(battles, IDS, { iterations: 200, seed: 11 });
    expect(a).toEqual(b);
  });

  it("orders ratings, brackets them with the CI, and is confident in a clear winner", () => {
    const result = bootstrapArena(dominanceBattles(), IDS, { iterations: 300, seed: 5 });
    const byId = Object.fromEntries(result.map((r) => [r.variantId, r]));
    expect(byId.A.rating).toBeGreaterThan(byId.B.rating);
    expect(byId.B.rating).toBeGreaterThan(byId.C.rating);
    for (const r of result) {
      expect(r.ciLow).toBeLessThanOrEqual(r.rating + 1e-6);
      expect(r.ciHigh).toBeGreaterThanOrEqual(r.rating - 1e-6);
    }
    expect(byId.A.pRank1).toBeGreaterThan(0.8);
    expect(byId.C.pRank1).toBeLessThan(0.2);
  });

  it("returns neutral, zero-confidence values with no battles", () => {
    const result = bootstrapArena([], IDS, { iterations: 50 });
    for (const r of result) {
      expect(r.pRank1).toBe(0);
      expect(r.winRate).toBe(0);
    }
  });
});

describe("bootstrapMeans", () => {
  it("recovers the point mean and brackets it with the CI", () => {
    const result = bootstrapMeans({ A: [8, 9, 7, 8], B: [3, 4, 2] }, { iterations: 300, seed: 2 });
    const byId = Object.fromEntries(result.map((r) => [r.variantId, r]));
    expect(byId.A.mean).toBeCloseTo(8, 6);
    expect(byId.A.ciLow).toBeLessThanOrEqual(byId.A.mean);
    expect(byId.A.ciHigh).toBeGreaterThanOrEqual(byId.A.mean);
    expect(byId.A.mean).toBeGreaterThan(byId.B.mean);
  });

  it("handles an empty score list", () => {
    const result = bootstrapMeans({ A: [] }, { iterations: 10 });
    expect(result[0]).toMatchObject({ variantId: "A", mean: 0, ciLow: 0, ciHigh: 0 });
  });
});
