import { describe, expect, it } from "vitest";
import { daysAgo, hoursAgo, mergedPr, NOW, pr } from "@/test/builders";
import {
  openPullRequestAgeBuckets,
  summarizePullRequests,
  weeklyPullRequestFlow,
} from "./pull-requests";

describe("summarizePullRequests", () => {
  it("counts open, draft, merged and closed-without-merge separately", () => {
    const summary = summarizePullRequests(
      [
        pr({ number: 1 }),
        pr({ number: 2, draft: true }),
        mergedPr(48, 12, { number: 3 }),
        pr({ number: 4, state: "closed", closedAt: daysAgo(1) }),
      ],
      NOW,
    );
    expect(summary).toMatchObject({
      open: 2,
      openReady: 1,
      openDraft: 1,
      merged: 1,
      closedUnmerged: 1,
    });
  });

  it("flags open PRs as stale only once idle for the configured number of days", () => {
    const fresh = pr({ number: 1, updatedAt: daysAgo(13) });
    const boundary = pr({ number: 2, updatedAt: daysAgo(14) });
    const old = pr({ number: 3, updatedAt: daysAgo(40) });
    const summary = summarizePullRequests([fresh, boundary, old], NOW, {
      stalePullRequestDays: 14,
    });
    expect(summary.stale.map((p) => p.number)).toEqual([3, 2]); // oldest activity first
  });

  it("honours a custom stale threshold", () => {
    const summary = summarizePullRequests([pr({ updatedAt: daysAgo(5) })], NOW, {
      stalePullRequestDays: 3,
    });
    expect(summary.stale).toHaveLength(1);
    expect(summary.staleDays).toBe(3);
  });

  it("computes median and p90 time to merge from merged PRs only", () => {
    const summary = summarizePullRequests(
      [mergedPr(100, 10), mergedPr(100, 20), mergedPr(100, 30), pr({ number: 99 })],
      NOW,
    );
    expect(summary.timeToMerge.sampleSize).toBe(3);
    expect(summary.timeToMerge.medianHours).toBeCloseTo(20);
    expect(summary.timeToMerge.p90Hours).toBeCloseTo(28);
  });

  it("returns null merge stats when there are no merged PRs", () => {
    const summary = summarizePullRequests([pr()], NOW);
    expect(summary.timeToMerge).toEqual({ sampleSize: 0, medianHours: null, p90Hours: null });
  });

  it("ignores merged PRs with a merge time before creation (bad data)", () => {
    const bad = pr({
      state: "closed",
      merged: true,
      createdAt: daysAgo(1),
      mergedAt: daysAgo(2),
      closedAt: daysAgo(2),
    });
    const summary = summarizePullRequests([bad], NOW);
    expect(summary.timeToMerge.sampleSize).toBe(0);
  });

  it("reports open PR age", () => {
    const summary = summarizePullRequests(
      [
        pr({ createdAt: daysAgo(2) }),
        pr({ createdAt: daysAgo(10) }),
        pr({ createdAt: daysAgo(30) }),
      ],
      NOW,
    );
    expect(summary.openAge.medianDays).toBeCloseTo(10);
    expect(summary.openAge.oldestDays).toBeCloseTo(30);
  });

  it("returns null age for no open PRs", () => {
    expect(summarizePullRequests([], NOW).openAge).toEqual({ medianDays: null, oldestDays: null });
  });

  describe("review status", () => {
    it("groups open, ready PRs by review state and excludes drafts", () => {
      const summary = summarizePullRequests(
        [
          pr({ number: 1, reviewState: "approved" }),
          pr({ number: 2, reviewState: "changes_requested" }),
          pr({ number: 3, reviewState: "no_reviews", createdAt: daysAgo(5) }),
          pr({ number: 4, reviewState: "review_requested", createdAt: daysAgo(9) }),
          pr({ number: 5, draft: true, reviewState: "no_reviews" }),
        ],
        NOW,
      );
      expect(summary.review.counts).toMatchObject({
        approved: 1,
        changes_requested: 1,
        no_reviews: 1,
        review_requested: 1,
      });
      // Oldest first, drafts excluded.
      expect(summary.review.awaitingReview.map((p) => p.number)).toEqual([4, 3]);
    });

    it("counts PRs whose reviews were not fetched as unknown rather than guessing", () => {
      const summary = summarizePullRequests(
        [pr({ reviewState: null }), pr({ reviewState: "approved" })],
        NOW,
      );
      expect(summary.review.unknown).toBe(1);
      expect(summary.review.counts.approved).toBe(1);
      expect(summary.review.counts.no_reviews).toBe(0);
    });
  });
});

describe("weeklyPullRequestFlow", () => {
  it("buckets opened, merged and closed-unmerged by UTC week and ignores out-of-window events", () => {
    const flow = weeklyPullRequestFlow(
      [
        pr({ createdAt: daysAgo(1) }), // current week (Jun 14)
        mergedPr(24 * 9, 24 * 2), // opened Jun 8 (week of Jun 7), merged Jun 10 (week of Jun 7)
        pr({ state: "closed", createdAt: daysAgo(20), closedAt: daysAgo(1), mergedAt: null }),
        pr({ createdAt: daysAgo(400) }), // far outside the window
      ],
      NOW,
      3,
    );
    expect(flow).toEqual([
      { weekStart: "2026-05-31", opened: 0, merged: 0, closedUnmerged: 0 },
      { weekStart: "2026-06-07", opened: 1, merged: 1, closedUnmerged: 0 },
      { weekStart: "2026-06-14", opened: 1, merged: 0, closedUnmerged: 1 },
    ]);
  });

  it("returns zero-filled weeks when there is no data", () => {
    const flow = weeklyPullRequestFlow([], NOW, 4);
    expect(flow).toHaveLength(4);
    expect(flow.every((week) => week.opened === 0 && week.merged === 0)).toBe(true);
  });
});

describe("openPullRequestAgeBuckets", () => {
  it("places open PRs in age buckets and skips closed ones", () => {
    const buckets = openPullRequestAgeBuckets(
      [
        pr({ createdAt: hoursAgo(5) }),
        pr({ createdAt: daysAgo(4) }),
        pr({ createdAt: daysAgo(10) }),
        pr({ createdAt: daysAgo(20) }),
        pr({ createdAt: daysAgo(60) }),
        mergedPr(100, 10),
      ],
      NOW,
    );
    expect(buckets.map((b) => b.count)).toEqual([1, 1, 1, 1, 1]);
  });
});
