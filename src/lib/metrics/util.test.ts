import { describe, expect, it } from "vitest";
import { NOW } from "@/test/builders";
import { median, percentile, ratio, recentDays, recentWeekStarts, weekStartUtc } from "./util";

describe("median / percentile", () => {
  it("returns null for an empty list", () => {
    expect(median([])).toBeNull();
    expect(percentile([], 90)).toBeNull();
  });

  it("handles odd and even lengths", () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it("interpolates percentiles like NumPy's default", () => {
    expect(percentile([1, 2, 3, 4, 5], 90)).toBeCloseTo(4.6);
    expect(percentile([10], 99)).toBe(10);
  });

  it("ignores non-finite values and does not mutate its input", () => {
    const input = [3, Number.NaN, 1, 2];
    expect(median(input)).toBe(2);
    expect(input).toEqual([3, Number.NaN, 1, 2]);
  });

  it("clamps out-of-range percentiles", () => {
    expect(percentile([1, 2, 3], 150)).toBe(3);
    expect(percentile([1, 2, 3], -5)).toBe(1);
  });
});

describe("week helpers", () => {
  it("starts weeks on Sunday (UTC)", () => {
    // 2026-06-17 is a Wednesday, so its week starts Sunday 2026-06-14.
    expect(weekStartUtc(NOW)).toBe("2026-06-14");
    expect(weekStartUtc(new Date("2026-06-14T00:00:00Z"))).toBe("2026-06-14");
    expect(weekStartUtc(new Date("2026-06-13T23:59:59Z"))).toBe("2026-06-07");
  });

  it("lists recent week starts oldest first, ending with the current week", () => {
    expect(recentWeekStarts(NOW, 3)).toEqual(["2026-05-31", "2026-06-07", "2026-06-14"]);
  });

  it("lists recent days oldest first", () => {
    expect(recentDays(NOW, 3)).toEqual(["2026-06-15", "2026-06-16", "2026-06-17"]);
  });
});

describe("ratio", () => {
  it("avoids division by zero", () => {
    expect(ratio(1, 0)).toBeNull();
    expect(ratio(1, 4)).toBe(0.25);
  });
});
