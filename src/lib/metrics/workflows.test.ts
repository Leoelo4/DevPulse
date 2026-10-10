import { describe, expect, it } from "vitest";
import { daysAgo, hoursAgo, NOW, run } from "@/test/builders";
import { dailyRunOutcomes, isDecisive, latestCiStatus, summarizeWorkflowRuns } from "./workflows";

describe("run classification", () => {
  it("treats only success/failure/timeouts as decisive", () => {
    expect(isDecisive(run({ conclusion: "success" }))).toBe(true);
    expect(isDecisive(run({ conclusion: "failure" }))).toBe(true);
    expect(isDecisive(run({ conclusion: "timed_out" }))).toBe(true);
    expect(isDecisive(run({ conclusion: "cancelled" }))).toBe(false);
    expect(isDecisive(run({ conclusion: "skipped" }))).toBe(false);
    expect(isDecisive(run({ status: "in_progress", conclusion: null }))).toBe(false);
  });
});

describe("latestCiStatus", () => {
  it("reports no_runs for an empty list", () => {
    expect(latestCiStatus([])).toBe("no_runs");
  });

  it("uses the newest decisive run", () => {
    expect(
      latestCiStatus([
        run({ conclusion: "success", createdAt: daysAgo(3) }),
        run({ conclusion: "failure", createdAt: daysAgo(1) }),
      ]),
    ).toBe("failing");
  });

  it("skips cancelled runs when finding the latest outcome", () => {
    expect(
      latestCiStatus([
        run({ conclusion: "success", createdAt: daysAgo(3) }),
        run({ conclusion: "cancelled", createdAt: daysAgo(1) }),
      ]),
    ).toBe("passing");
  });

  it("reports running when the newest run has not completed", () => {
    expect(
      latestCiStatus([
        run({ conclusion: "failure", createdAt: daysAgo(1) }),
        run({ status: "in_progress", conclusion: null, createdAt: hoursAgo(1) }),
      ]),
    ).toBe("running");
  });

  it("scopes to a branch when asked", () => {
    const runs = [
      run({ branch: "main", conclusion: "success", createdAt: daysAgo(2) }),
      run({ branch: "feat/x", conclusion: "failure", createdAt: daysAgo(1) }),
    ];
    expect(latestCiStatus(runs, "main")).toBe("passing");
    expect(latestCiStatus(runs, "feat/x")).toBe("failing");
    expect(latestCiStatus(runs, "missing")).toBe("no_runs");
  });

  it("is failing if ANY workflow's latest decisive run failed, even when another workflow passed more recently", () => {
    expect(
      latestCiStatus([
        run({ name: "CI", conclusion: "failure", createdAt: daysAgo(2) }),
        run({ name: "E2E", conclusion: "success", createdAt: daysAgo(1) }),
      ]),
    ).toBe("failing");
  });

  it("only considers a workflow's latest result, so an old failure that was fixed is not failing", () => {
    expect(
      latestCiStatus([
        run({ name: "CI", conclusion: "failure", createdAt: daysAgo(5) }),
        run({ name: "CI", conclusion: "success", createdAt: daysAgo(1) }),
      ]),
    ).toBe("passing");
  });

  it("prefers failing over running when different workflows disagree", () => {
    expect(
      latestCiStatus([
        run({ name: "CI", conclusion: "failure", createdAt: daysAgo(2) }),
        run({ name: "Deploy", status: "in_progress", conclusion: null, createdAt: hoursAgo(1) }),
      ]),
    ).toBe("failing");
  });

  it("does not mutate its input", () => {
    const runs = [run({ createdAt: daysAgo(3) }), run({ createdAt: daysAgo(1) })];
    const before = runs.map((r) => r.id);
    latestCiStatus(runs);
    expect(runs.map((r) => r.id)).toEqual(before);
  });
});

describe("summarizeWorkflowRuns", () => {
  it("excludes non-decisive runs from the success rate", () => {
    const summary = summarizeWorkflowRuns(
      [
        run({ conclusion: "success" }),
        run({ conclusion: "success" }),
        run({ conclusion: "success" }),
        run({ conclusion: "failure" }),
        run({ conclusion: "cancelled" }),
        run({ conclusion: "skipped" }),
      ],
      NOW,
    );
    expect(summary.totalRuns).toBe(6);
    expect(summary.decisiveRuns).toBe(4);
    expect(summary.successRate).toBeCloseTo(0.75);
  });

  it("has a null success rate when nothing is decisive", () => {
    const summary = summarizeWorkflowRuns([run({ conclusion: "cancelled" })], NOW);
    expect(summary.successRate).toBeNull();
  });

  it("counts recent failures within 7 and 30 days", () => {
    const summary = summarizeWorkflowRuns(
      [
        run({ conclusion: "failure", createdAt: daysAgo(2) }),
        run({ conclusion: "failure", createdAt: daysAgo(10) }),
        run({ conclusion: "failure", createdAt: daysAgo(45) }),
      ],
      NOW,
    );
    expect(summary.failuresLast7Days).toBe(1);
    expect(summary.failuresLast30Days).toBe(2);
  });

  it("computes median duration from completed runs with a duration", () => {
    const summary = summarizeWorkflowRuns(
      [
        run({ durationSeconds: 60 }),
        run({ durationSeconds: 180 }),
        run({ durationSeconds: null }),
        run({ status: "in_progress", conclusion: null, durationSeconds: 5 }),
      ],
      NOW,
    );
    expect(summary.medianDurationSeconds).toBe(120);
  });

  it("prefers the default branch for current status but falls back to any branch", () => {
    const onlyFeature = [run({ branch: "feat/x", conclusion: "failure" })];
    expect(summarizeWorkflowRuns(onlyFeature, NOW, "main").currentStatus).toBe("failing");
    const both = [
      run({ branch: "feat/x", conclusion: "failure", createdAt: hoursAgo(1) }),
      run({ branch: "main", conclusion: "success", createdAt: hoursAgo(5) }),
    ];
    expect(summarizeWorkflowRuns(both, NOW, "main").currentStatus).toBe("passing");
  });

  it("breaks results down per workflow", () => {
    const summary = summarizeWorkflowRuns(
      [
        run({ name: "CI", conclusion: "failure", createdAt: hoursAgo(1) }),
        run({ name: "CI", conclusion: "success", createdAt: hoursAgo(5) }),
        run({ name: "Deploy", conclusion: "success", createdAt: hoursAgo(10) }),
      ],
      NOW,
    );
    const ci = summary.perWorkflow.find((w) => w.name === "CI");
    expect(ci).toMatchObject({
      runs: 2,
      failures: 1,
      failureRate: 0.5,
      latestConclusion: "failure",
    });
    expect(summary.perWorkflow.map((w) => w.name)).toEqual(["CI", "Deploy"]); // newest first
  });
});

describe("dailyRunOutcomes", () => {
  it("zero-fills days and counts decisive outcomes by UTC day", () => {
    const outcomes = dailyRunOutcomes(
      [
        run({ conclusion: "success", createdAt: "2026-06-17T01:00:00Z" }),
        run({ conclusion: "failure", createdAt: "2026-06-17T02:00:00Z" }),
        run({ conclusion: "cancelled", createdAt: "2026-06-16T02:00:00Z" }),
        run({ conclusion: "success", createdAt: "2026-05-01T02:00:00Z" }), // outside window
      ],
      NOW,
      3,
    );
    expect(outcomes).toEqual([
      { date: "2026-06-15", success: 0, failure: 0 },
      { date: "2026-06-16", success: 0, failure: 0 },
      { date: "2026-06-17", success: 1, failure: 1 },
    ]);
  });
});
