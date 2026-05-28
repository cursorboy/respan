import { describe, it, expect } from "vitest";
import { mean, mulberry32, percentile, resampleIndices, stddev } from "../stats";

describe("mulberry32", () => {
  it("is deterministic for a given seed", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = [a(), a(), a()];
    const seqB = [b(), b(), b()];
    expect(seqA).toEqual(seqB);
  });

  it("produces values in [0, 1)", () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("differs across seeds", () => {
    expect(mulberry32(1)()).not.toEqual(mulberry32(2)());
  });
});

describe("mean / stddev", () => {
  it("computes the mean", () => {
    expect(mean([2, 4, 6])).toBe(4);
    expect(mean([])).toBe(0);
  });

  it("computes sample stddev, 0 for <2 values", () => {
    expect(stddev([5])).toBe(0);
    expect(stddev([2, 4])).toBeCloseTo(Math.sqrt(2), 6);
  });
});

describe("percentile", () => {
  it("returns the median", () => {
    expect(percentile([1, 2, 3, 4, 5], 50)).toBe(3);
  });

  it("interpolates", () => {
    expect(percentile([0, 10], 25)).toBeCloseTo(2.5, 6);
  });

  it("handles the extremes and single values", () => {
    expect(percentile([3, 1, 2], 0)).toBe(1);
    expect(percentile([3, 1, 2], 100)).toBe(3);
    expect(percentile([9], 50)).toBe(9);
  });
});

describe("resampleIndices", () => {
  it("returns n indices within range, deterministically", () => {
    const idx = resampleIndices(5, mulberry32(3));
    expect(idx).toHaveLength(5);
    for (const i of idx) {
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(5);
    }
    expect(resampleIndices(5, mulberry32(3))).toEqual(idx);
  });
});
