import { describe, expect, it } from "vitest";
import { contributor, NOW } from "@/test/builders";
import { commitMomentum, commitsInTrailingDays, summarizeContributors } from "./contributors";

describe("summarizeContributors", () => {
  it("uses 90-day commits when every contributor has them", () => {
    const summary = summarizeContributors([
      contributor({ login: "a", totalCommits: 1000, commitsLast90Days: 10 }),
      contributor({ login: "b", totalCommits: 10, commitsLast90Days: 30 }),
      contributor({ login: "c", totalCommits: 10, commitsLast90Days: 0 }),
    ]);
    expect(summary.activeLast90Days).toBe(2);
    expect(summary.topContributorShare).toEqual({ login: "b", share: 0.75, basis: "last_90_days" });
  });

  it("falls back to all-time totals when recent data is missing, and says so", () => {
    const summary = summarizeContributors([
      contributor({ login: "a", totalCommits: 90, commitsLast90Days: null }),
      contributor({ login: "b", totalCommits: 10, commitsLast90Days: null }),
    ]);
    expect(summary.activeLast90Days).toBeNull();
    expect(summary.topContributorShare).toEqual({ login: "a", share: 0.9, basis: "all_time" });
  });

  it("handles no contributors", () => {
    expect(summarizeContributors([])).toEqual({
      total: 0,
      activeLast90Days: null,
      topContributorShare: null,
    });
  });
});

const weeks = (counts: number[]) =>
  counts.map((commits, i) => ({
    weekStart: new Date(Date.UTC(2026, 3, 5 + i * 7)).toISOString().slice(0, 10),
    commits,
  }));

describe("commitMomentum", () => {
  it("needs at least eight weeks", () => {
    expect(commitMomentum(weeks([1, 2, 3]))).toBeNull();
  });

  it("compares the last four weeks with the four before", () => {
    const momentum = commitMomentum(weeks([5, 5, 5, 5, 10, 10, 10, 10]));
    expect(momentum).toMatchObject({ recent: 40, previous: 20, direction: "up" });
    expect(momentum?.changeRatio).toBeCloseTo(1);
  });

  it("detects decline and treats small changes as flat", () => {
    expect(commitMomentum(weeks([10, 10, 10, 10, 4, 4, 4, 4]))?.direction).toBe("down");
    expect(commitMomentum(weeks([10, 10, 10, 10, 10, 10, 10, 11]))?.direction).toBe("flat");
  });

  it("does not divide by zero when the prior period was empty", () => {
    const momentum = commitMomentum(weeks([0, 0, 0, 0, 3, 0, 0, 0]));
    expect(momentum?.changeRatio).toBeNull();
    expect(momentum?.direction).toBe("up");
  });
});

describe("commitsInTrailingDays", () => {
  it("includes weeks that overlap the trailing window", () => {
    const data = [
      { weekStart: "2026-05-10", commits: 100 }, // ends May 17 00:00 — before the 30-day cutoff
      { weekStart: "2026-05-17", commits: 4 }, // ends May 24 — overlaps the 30-day window
      { weekStart: "2026-06-07", commits: 6 }, // ends Jun 14 — overlaps the 7-day window
      { weekStart: "2026-06-14", commits: 2 }, // current week
    ];
    // A week counts when it ends after the cutoff. NOW = Jun 17 12:00 UTC.
    // 30-day cutoff = May 18 12:00; 7-day cutoff = Jun 10 12:00.
    expect(commitsInTrailingDays(data, NOW, 30)).toBe(4 + 6 + 2);
    expect(commitsInTrailingDays(data, NOW, 7)).toBe(6 + 2);
  });
});
