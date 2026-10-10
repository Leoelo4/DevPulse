import { describe, expect, it } from "vitest";
import { daysAgo, hoursAgo, issue, NOW } from "@/test/builders";
import { summarizeIssues, weeklyIssueFlow } from "./issues";

describe("summarizeIssues", () => {
  it("counts open and closed issues", () => {
    const summary = summarizeIssues(
      [issue(), issue(), issue({ state: "closed", closedAt: daysAgo(1) })],
      NOW,
    );
    expect(summary.open).toBe(2);
    expect(summary.closed).toBe(1);
  });

  it("detects stale open issues by last activity", () => {
    const summary = summarizeIssues(
      [
        issue({ number: 1, updatedAt: daysAgo(31) }),
        issue({ number: 2, updatedAt: daysAgo(29) }),
        issue({ number: 3, state: "closed", closedAt: daysAgo(40), updatedAt: daysAgo(40) }),
      ],
      NOW,
      { staleIssueDays: 30 },
    );
    expect(summary.stale.map((i) => i.number)).toEqual([1]);
  });

  describe("first response", () => {
    it("computes the median time to first response from responded issues only", () => {
      const summary = summarizeIssues(
        [
          issue({
            createdAt: hoursAgo(100),
            firstResponse: { status: "responded", at: hoursAgo(98) },
          }), // 2h
          issue({
            createdAt: hoursAgo(100),
            firstResponse: { status: "responded", at: hoursAgo(94) },
          }), // 6h
          issue({
            createdAt: hoursAgo(100),
            firstResponse: { status: "responded", at: hoursAgo(90) },
          }), // 10h
        ],
        NOW,
      );
      expect(summary.firstResponse.sampleSize).toBe(3);
      expect(summary.firstResponse.medianHours).toBeCloseTo(6);
    });

    it("separates 'no reply yet' from 'not inspected'", () => {
      const summary = summarizeIssues(
        [
          issue({ firstResponse: { status: "none" } }),
          issue({ firstResponse: { status: "none" }, state: "closed", closedAt: daysAgo(1) }),
          issue({ firstResponse: { status: "unknown" } }),
        ],
        NOW,
      );
      // Only the *open* issue with no reply counts as awaiting; closed ones are history.
      expect(summary.firstResponse.awaitingResponse).toBe(1);
      expect(summary.firstResponse.unknown).toBe(1);
      expect(summary.firstResponse.medianHours).toBeNull();
    });
  });

  it("computes median time to close from closed issues", () => {
    const summary = summarizeIssues(
      [
        issue({ state: "closed", createdAt: daysAgo(10), closedAt: daysAgo(8) }), // 2d
        issue({ state: "closed", createdAt: daysAgo(10), closedAt: daysAgo(4) }), // 6d
        issue(),
      ],
      NOW,
    );
    expect(summary.timeToClose.sampleSize).toBe(2);
    expect(summary.timeToClose.medianDays).toBeCloseTo(4);
  });

  it("handles an empty list", () => {
    const summary = summarizeIssues([], NOW);
    expect(summary.open).toBe(0);
    expect(summary.firstResponse.medianHours).toBeNull();
    expect(summary.timeToClose.medianDays).toBeNull();
  });
});

describe("weeklyIssueFlow", () => {
  it("buckets opened and closed issues by week", () => {
    const flow = weeklyIssueFlow(
      [
        issue({ createdAt: daysAgo(1) }),
        issue({ state: "closed", createdAt: daysAgo(10), closedAt: daysAgo(2) }),
      ],
      NOW,
      2,
    );
    expect(flow).toEqual([
      { weekStart: "2026-06-07", opened: 1, closed: 0 },
      { weekStart: "2026-06-14", opened: 1, closed: 1 },
    ]);
  });
});
