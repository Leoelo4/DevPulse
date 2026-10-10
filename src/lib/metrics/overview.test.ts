import { describe, expect, it } from "vitest";
import {
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
import { buildActivityFeed, buildOverview } from "./overview";

const repoA = repository({ id: 1, name: "a", fullName: "sample-org/a", pushedAt: daysAgo(3) });
const repoB = repository({ id: 2, name: "b", fullName: "sample-org/b", pushedAt: daysAgo(1) });

describe("buildOverview", () => {
  it("sums open pull requests across repositories and reports full coverage", () => {
    const overview = buildOverview(
      [
        snapshot({ repository: repoA, pullRequests: ok([pr(), pr(), mergedPr(40, 5)]) }),
        snapshot({ repository: repoB, pullRequests: ok([pr()]) }),
      ],
      NOW,
    );
    expect(overview.openPullRequests).toEqual({
      value: 3,
      coveredRepos: 2,
      totalRepos: 2,
      exact: true,
    });
  });

  it("reports reduced coverage when a repository could not be read, instead of counting it as zero", () => {
    const overview = buildOverview(
      [snapshot({ repository: repoA, pullRequests: ok([pr()]) }), snapshot({ repository: repoB })],
      NOW,
    );
    expect(overview.openPullRequests.value).toBe(1);
    expect(overview.openPullRequests.coveredRepos).toBe(1);
    expect(overview.openPullRequests.totalRepos).toBe(2);
  });

  it("marks a figure inexact when a contributing dataset was truncated", () => {
    const overview = buildOverview(
      [snapshot({ repository: repoA, issues: ok([issue(), issue()], false) })],
      NOW,
    );
    expect(overview.openIssues).toMatchObject({ value: 2, exact: false });
  });

  it("counts workflow failures from the last 7 days only", () => {
    const overview = buildOverview(
      [
        snapshot({
          repository: repoA,
          workflowRuns: ok([
            run({ conclusion: "failure", createdAt: daysAgo(1) }),
            run({ conclusion: "failure", createdAt: daysAgo(9) }),
            run({ conclusion: "success", createdAt: daysAgo(1) }),
          ]),
        }),
      ],
      NOW,
    );
    expect(overview.workflowFailuresLast7Days.value).toBe(1);
  });

  it("lists recent releases newest first across repositories and skips drafts", () => {
    const overview = buildOverview(
      [
        snapshot({
          repository: repoA,
          releases: ok([release({ id: 1, tagName: "v1", publishedAt: daysAgo(10) })]),
        }),
        snapshot({
          repository: repoB,
          releases: ok([
            release({ id: 2, tagName: "v2", publishedAt: daysAgo(2) }),
            release({ id: 3, tagName: "draft", draft: true, publishedAt: daysAgo(1) }),
          ]),
        }),
      ],
      NOW,
    );
    expect(overview.recentReleases.map((r) => r.release.tagName)).toEqual(["v2", "v1"]);
    expect(overview.releasesLast30Days.value).toBe(2);
  });

  it("orders recently active repositories by last push", () => {
    const overview = buildOverview(
      [snapshot({ repository: repoA }), snapshot({ repository: repoB })],
      NOW,
    );
    expect(overview.recentlyActive.map((r) => r.repoFullName)).toEqual([
      "sample-org/b",
      "sample-org/a",
    ]);
  });

  it("sums weekly commit activity across repositories that reported it", () => {
    const week = "2026-06-14";
    const overview = buildOverview(
      [
        snapshot({ repository: repoA, commitActivity: ok([{ weekStart: week, commits: 5 }]) }),
        snapshot({ repository: repoB, commitActivity: ok([{ weekStart: week, commits: 7 }]) }),
        snapshot({ repository: repository({ id: 3, name: "c", fullName: "sample-org/c" }) }),
      ],
      NOW,
    );
    expect(overview.contributionActivity.coveredRepos).toBe(2);
    expect(overview.contributionActivity.totalRepos).toBe(3);
    expect(overview.contributionActivity.weeks.at(-1)).toEqual({ weekStart: week, commits: 12 });
  });

  it("handles an empty repository list", () => {
    const overview = buildOverview([], NOW);
    expect(overview.repositoryCount).toBe(0);
    expect(overview.openPullRequests).toEqual({
      value: 0,
      coveredRepos: 0,
      totalRepos: 0,
      exact: true,
    });
    expect(overview.activity).toEqual([]);
    expect(overview.health).toEqual([]);
  });
});

describe("buildActivityFeed", () => {
  it("merges events newest first, limits the window and the count", () => {
    const feed = buildActivityFeed(
      [
        snapshot({
          repository: repoA,
          pullRequests: ok([
            pr({ number: 1, createdAt: daysAgo(1) }),
            pr({ number: 2, createdAt: daysAgo(60) }), // outside window
          ]),
          issues: ok([issue({ number: 3, createdAt: daysAgo(2) })]),
          workflowRuns: ok([
            run({
              conclusion: "failure",
              branch: "main",
              updatedAt: daysAgo(3),
              createdAt: daysAgo(3),
            }),
          ]),
        }),
      ],
      NOW,
      10,
    );
    expect(feed.map((e) => e.kind)).toEqual([
      "pull_request_opened",
      "issue_opened",
      "workflow_failed",
    ]);
    expect(feed.every((e) => e.repoFullName === "sample-org/a")).toBe(true);
  });

  it("emits a merged event (not a closed one) for merged PRs and gives every event a unique id", () => {
    const feed = buildActivityFeed(
      [snapshot({ repository: repoA, pullRequests: ok([mergedPr(48, 12, { number: 7 })]) })],
      NOW,
    );
    expect(feed.map((e) => e.kind).sort()).toEqual(["pull_request_merged", "pull_request_opened"]);
    expect(new Set(feed.map((e) => e.id)).size).toBe(feed.length);
  });

  it("respects the limit", () => {
    const many = Array.from({ length: 30 }, (_, i) =>
      pr({ number: i + 1, createdAt: daysAgo(i / 10) }),
    );
    expect(
      buildActivityFeed([snapshot({ repository: repoA, pullRequests: ok(many) })], NOW, 5),
    ).toHaveLength(5);
  });
});
