import { describe, expect, it } from "vitest";
import {
  contributor,
  daysAgo,
  issue,
  mergedPr,
  NOW,
  ok,
  pr,
  release,
  repository,
  run,
  snapshot,
} from "@/test/builders";
import { buildRecommendations, evaluateHealth, summarizeHealth } from "./health";

const find = (id: string, snap = snapshot()) => {
  const indicator = evaluateHealth(snap, NOW).find((i) => i.id === id);
  if (!indicator) throw new Error(`indicator ${id} missing`);
  return indicator;
};

describe("evaluateHealth", () => {
  it("never reports a pass when data is unavailable — it reports unknown", () => {
    const indicators = evaluateHealth(snapshot(), NOW);
    expect(indicators).toHaveLength(6);
    expect(indicators.every((i) => i.status === "unknown")).toBe(true);
  });

  it("states what every indicator measures and what it cannot tell you", () => {
    for (const indicator of evaluateHealth(snapshot(), NOW)) {
      expect(indicator.measures.length).toBeGreaterThan(10);
      expect(indicator.limitation.length).toBeGreaterThan(10);
    }
  });

  describe("CI reliability", () => {
    it("is unknown with too few decisive runs, even if the latest run passed", () => {
      const snap = snapshot({ workflowRuns: ok([run({ conclusion: "success" })]) });
      expect(find("ci-reliability", snap).status).toBe("unknown");
    });

    it("grades by success rate", () => {
      const mk = (successes: number, failures: number) =>
        snapshot({
          workflowRuns: ok([
            ...Array.from({ length: successes }, () => run({ conclusion: "success" })),
            ...Array.from({ length: failures }, () => run({ conclusion: "failure" })),
          ]),
        });
      expect(find("ci-reliability", mk(19, 1)).status).toBe("good");
      expect(find("ci-reliability", mk(8, 2)).status).toBe("warning");
      expect(find("ci-reliability", mk(5, 5)).status).toBe("poor");
    });
  });

  describe("PR backlog", () => {
    it("is good when there are no open PRs", () => {
      expect(find("pr-backlog", snapshot({ pullRequests: ok([mergedPr(50, 5)]) })).status).toBe(
        "good",
      );
    });

    it("scales with the share of stale open PRs", () => {
      const stale = (n: number) => Array.from({ length: n }, () => pr({ updatedAt: daysAgo(40) }));
      const fresh = (n: number) => Array.from({ length: n }, () => pr({ updatedAt: daysAgo(1) }));
      expect(
        find("pr-backlog", snapshot({ pullRequests: ok([...stale(1), ...fresh(9)]) })).status,
      ).toBe("good");
      expect(
        find("pr-backlog", snapshot({ pullRequests: ok([...stale(3), ...fresh(7)]) })).status,
      ).toBe("warning");
      expect(
        find("pr-backlog", snapshot({ pullRequests: ok([...stale(8), ...fresh(2)]) })).status,
      ).toBe("poor");
    });
  });

  describe("release cadence", () => {
    it("is unknown (not poor) when a repo has never published a release", () => {
      expect(find("release-cadence", snapshot({ releases: ok([]) })).status).toBe("unknown");
    });

    it("flags overdue releases relative to the threshold", () => {
      const at = (days: number) =>
        snapshot({ releases: ok([release({ publishedAt: daysAgo(days) })]) });
      expect(find("release-cadence", at(30)).status).toBe("good");
      expect(find("release-cadence", at(120)).status).toBe("warning");
      expect(find("release-cadence", at(400)).status).toBe("poor");
    });
  });

  describe("contributor spread", () => {
    it("needs at least two contributors", () => {
      const snap = snapshot({ contributors: ok([contributor({ commitsLast90Days: 50 })]) });
      expect(find("contributor-concentration", snap).status).toBe("unknown");
    });

    it("grades by the top contributor's share", () => {
      const snap = snapshot({
        contributors: ok([
          contributor({ commitsLast90Days: 95 }),
          contributor({ commitsLast90Days: 5 }),
        ]),
      });
      expect(find("contributor-concentration", snap).status).toBe("poor");
    });
  });

  describe("issue responsiveness", () => {
    it("is unknown without any response data", () => {
      const snap = snapshot({ issues: ok([issue({ firstResponse: { status: "unknown" } })]) });
      expect(find("issue-responsiveness", snap).status).toBe("unknown");
    });

    it("is poor when most open issues are stale", () => {
      const snap = snapshot({
        issues: ok([
          issue({ updatedAt: daysAgo(90), firstResponse: { status: "none" } }),
          issue({ updatedAt: daysAgo(90), firstResponse: { status: "none" } }),
        ]),
      });
      expect(find("issue-responsiveness", snap).status).toBe("poor");
    });
  });
});

describe("summarizeHealth", () => {
  const indicator = (status: "good" | "warning" | "poor" | "unknown") => ({
    id: status,
    label: status,
    status,
    value: "",
    measures: "",
    limitation: "",
  });

  it("says 'not enough data' rather than 'healthy' when most indicators are unknown", () => {
    const summary = summarizeHealth([
      indicator("good"),
      indicator("unknown"),
      indicator("unknown"),
      indicator("unknown"),
      indicator("unknown"),
      indicator("unknown"),
    ]);
    expect(summary.level).toBe("insufficient_data");
  });

  it("is only healthy with no poor indicators and at most one warning", () => {
    const base = [indicator("good"), indicator("good"), indicator("good"), indicator("good")];
    expect(summarizeHealth(base).level).toBe("healthy");
    expect(summarizeHealth([...base, indicator("warning")]).level).toBe("healthy");
    expect(summarizeHealth([...base, indicator("warning"), indicator("warning")]).level).toBe(
      "needs_attention",
    );
    expect(summarizeHealth([...base, indicator("poor")]).level).toBe("needs_attention");
    expect(summarizeHealth([...base, indicator("poor"), indicator("poor")]).level).toBe("at_risk");
  });

  it("reports counts by status", () => {
    const summary = summarizeHealth([indicator("good"), indicator("poor"), indicator("unknown")]);
    expect(summary.counts).toEqual({ good: 1, warning: 0, poor: 1, unknown: 1 });
  });
});

describe("buildRecommendations", () => {
  it("returns nothing alarming for a quiet, licensed repository with no data", () => {
    expect(buildRecommendations(snapshot(), NOW)).toEqual([]);
  });

  it("puts a failing default-branch pipeline first", () => {
    const recs = buildRecommendations(
      snapshot({
        workflowRuns: ok([run({ conclusion: "failure", branch: "main", createdAt: daysAgo(1) })]),
        pullRequests: ok([pr({ updatedAt: daysAgo(30) })]),
      }),
      NOW,
    );
    expect(recs[0]?.id).toBe("ci-failing");
    expect(recs[0]?.severity).toBe("critical");
    expect(recs.map((r) => r.id)).toContain("stale-prs");
  });

  it("recommends adding a license when none is detected", () => {
    const recs = buildRecommendations(snapshot({ repository: repository({ license: null }) }), NOW);
    expect(recs.map((r) => r.id)).toContain("no-license");
  });

  it("pluralises correctly", () => {
    const one = buildRecommendations(
      snapshot({ pullRequests: ok([pr({ updatedAt: daysAgo(30) })]) }),
      NOW,
    );
    expect(one.find((r) => r.id === "stale-prs")?.title).toBe("Triage 1 stale pull request");
    const two = buildRecommendations(
      snapshot({
        pullRequests: ok([pr({ updatedAt: daysAgo(30) }), pr({ updatedAt: daysAgo(31) })]),
      }),
      NOW,
    );
    expect(two.find((r) => r.id === "stale-prs")?.title).toBe("Triage 2 stale pull requests");
  });
});
