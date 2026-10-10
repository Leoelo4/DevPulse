import { describe, expect, it } from "vitest";
import {
  commentPayload,
  commitActivityPayload,
  contributorStatsPayload,
  issuePayload,
  pullPayload,
  releasePayload,
  repoPayload,
  runPayload,
} from "@/test/github-fixtures";
import { NOW } from "@/test/builders";
import { UnexpectedResponseError } from "./errors";
import {
  parseCommitActivity,
  parseContributorList,
  parseContributorStats,
  parseDeployments,
  parseIssueComments,
  parseIssues,
  parseLatestDeploymentState,
  parsePullRequests,
  parseReleases,
  parseRepositories,
  parseRepository,
  parseReviews,
  parseTags,
  parseWorkflowRuns,
  safeGitHubUrl,
} from "./parse";

describe("safeGitHubUrl", () => {
  it("accepts https GitHub hosts only", () => {
    expect(safeGitHubUrl("https://github.com/o/r")).toBe("https://github.com/o/r");
    expect(safeGitHubUrl("https://avatars.githubusercontent.com/u/1")).not.toBeNull();
  });

  it.each([
    "javascript:alert(1)",
    "http://github.com/o/r",
    "https://evil.example/github.com/o/r",
    "https://github.com.evil.example/o/r",
    "data:text/html,<script>1</script>",
    "not a url",
    "",
  ])("rejects %j", (value) => {
    expect(safeGitHubUrl(value)).toBeNull();
  });

  it("handles null and undefined", () => {
    expect(safeGitHubUrl(null)).toBeNull();
    expect(safeGitHubUrl(undefined)).toBeNull();
  });
});

describe("parseRepository", () => {
  it("maps the fields DevPulse uses", () => {
    expect(parseRepository(repoPayload())).toMatchObject({
      id: 4242,
      owner: "sample-org",
      name: "sample-repo",
      fullName: "sample-org/sample-repo",
      primaryLanguage: "TypeScript",
      stars: 12,
      forks: 3,
      openIssuesAndPullsCount: 7,
      defaultBranch: "main",
      license: "MIT",
      htmlUrl: "https://github.com/sample-org/sample-repo",
    });
  });

  it("tolerates nulls and missing optional fields", () => {
    const parsed = parseRepository(
      repoPayload({
        description: null,
        language: null,
        license: null,
        topics: undefined,
        pushed_at: null,
      }),
    );
    expect(parsed).toMatchObject({
      description: null,
      primaryLanguage: null,
      license: null,
      topics: [],
      pushedAt: null,
    });
  });

  it("treats GitHub's NOASSERTION license as the license name, not an SPDX id", () => {
    const parsed = parseRepository(
      repoPayload({ license: { spdx_id: "NOASSERTION", name: "Other" } }),
    );
    expect(parsed.license).toBe("Other");
  });

  it("drops a non-GitHub html_url instead of rendering it", () => {
    expect(parseRepository(repoPayload({ html_url: "javascript:alert(1)" })).htmlUrl).toBeNull();
  });

  it("throws UnexpectedResponseError for a response of the wrong shape", () => {
    expect(() => parseRepository({ nope: true })).toThrow(UnexpectedResponseError);
    expect(() => parseRepository(null)).toThrow(UnexpectedResponseError);
  });
});

describe("list parsing", () => {
  it("skips and counts invalid records without losing the valid ones", () => {
    const { items, skipped } = parsePullRequests([
      pullPayload(1),
      { number: "nope" },
      null,
      pullPayload(2),
    ]);
    expect(items.map((p) => p.number)).toEqual([1, 2]);
    expect(skipped).toBe(2);
  });

  it("throws when the response is not a list at all", () => {
    expect(() => parsePullRequests({ message: "Not Found" })).toThrow(UnexpectedResponseError);
    expect(() => parseRepositories("nope")).toThrow(UnexpectedResponseError);
  });
});

describe("parsePullRequests", () => {
  it("derives merged from merged_at and counts requested reviewers and teams", () => {
    const { items } = parsePullRequests([
      pullPayload(1, {
        state: "closed",
        merged_at: "2026-06-10T00:00:00Z",
        closed_at: "2026-06-10T00:00:00Z",
        requested_reviewers: [{}, {}],
        requested_teams: [{}],
      }),
    ]);
    expect(items[0]).toMatchObject({
      merged: true,
      state: "closed",
      requestedReviewerCount: 3,
      reviewState: null,
    });
  });

  it("handles deleted authors, string labels and missing draft/reviewers", () => {
    const { items } = parsePullRequests([
      pullPayload(1, {
        user: null,
        labels: ["a", { name: "b" }, { name: null }],
        draft: undefined,
        requested_reviewers: undefined,
      }),
    ]);
    expect(items[0]).toMatchObject({
      author: null,
      labels: ["a", "b"],
      draft: false,
      requestedReviewerCount: 0,
    });
  });
});

describe("parseIssues", () => {
  it("removes pull requests, which GitHub returns from the issues endpoint", () => {
    const { items } = parseIssues([
      issuePayload(1),
      { ...issuePayload(2), pull_request: { url: "x" } },
    ]);
    expect(items.map((i) => i.number)).toEqual([1]);
  });

  it("starts every issue with an unknown first response", () => {
    expect(parseIssues([issuePayload(1)]).items[0]?.firstResponse).toEqual({ status: "unknown" });
  });
});

describe("parseReviews / parseIssueComments", () => {
  it("normalises review state casing and keeps reviewer and time", () => {
    const { items } = parseReviews([
      { user: { login: "a" }, state: "approved", submitted_at: "2026-06-01T00:00:00Z" },
    ]);
    expect(items[0]).toEqual({
      reviewer: "a",
      state: "APPROVED",
      submittedAt: "2026-06-01T00:00:00Z",
    });
  });

  it("extracts the issue number from issue_url and skips unparseable ones", () => {
    const { items, skipped } = parseIssueComments([
      commentPayload(12, "bob", "2026-06-01T00:00:00Z"),
      {
        issue_url: "https://api.github.com/repos/o/r/issues/not-a-number",
        user: null,
        created_at: "2026-06-01T00:00:00Z",
      },
    ]);
    expect(items).toEqual([{ issueNumber: 12, author: "bob", createdAt: "2026-06-01T00:00:00Z" }]);
    expect(skipped).toBe(1);
  });
});

describe("parseWorkflowRuns", () => {
  it("computes duration from run_started_at to updated_at for completed runs", () => {
    const { items } = parseWorkflowRuns([
      runPayload(1, { run_started_at: "2026-06-17T10:00:00Z", updated_at: "2026-06-17T10:02:30Z" }),
    ]);
    expect(items[0]?.durationSeconds).toBe(150);
  });

  it("leaves duration null while a run is in progress", () => {
    const { items } = parseWorkflowRuns([
      runPayload(1, { status: "in_progress", conclusion: null }),
    ]);
    expect(items[0]).toMatchObject({
      status: "in_progress",
      conclusion: null,
      durationSeconds: null,
    });
  });

  it("falls back safely for statuses and conclusions it does not know", () => {
    const { items } = parseWorkflowRuns([
      runPayload(1, { status: "brand_new", conclusion: "weird" }),
    ]);
    expect(items[0]).toMatchObject({ status: "pending", conclusion: null });
  });

  it("falls back to display_title when a run has no name", () => {
    const { items } = parseWorkflowRuns([
      runPayload(1, { name: null, display_title: "Fix things" }),
    ]);
    expect(items[0]?.name).toBe("Fix things");
  });

  it("never reports a negative duration", () => {
    const { items } = parseWorkflowRuns([
      runPayload(1, { run_started_at: "2026-06-17T10:10:00Z", updated_at: "2026-06-17T10:00:00Z" }),
    ]);
    expect(items[0]?.durationSeconds).toBe(0);
  });
});

describe("releases, tags and deployments", () => {
  it("maps releases and blanks empty names", () => {
    const { items } = parseReleases([
      releasePayload(1, { name: "" }),
      releasePayload(2, { published_at: null, draft: true }),
    ]);
    expect(items[0]?.name).toBeNull();
    expect(items[1]).toMatchObject({ publishedAt: null, draft: true });
  });

  it("shortens tag SHAs to 7 characters", () => {
    expect(parseTags([{ name: "v1", commit: { sha: "abcdef1234567890" } }]).items[0]).toEqual({
      name: "v1",
      sha: "abcdef1",
    });
  });

  it("reads the latest deployment status and treats anything unfamiliar as unknown", () => {
    expect(parseLatestDeploymentState([{ state: "success" }])).toBe("success");
    expect(parseLatestDeploymentState([{ state: "in_progress" }])).toBe("in_progress");
    expect(parseLatestDeploymentState([{ state: "mystery" }])).toBe("unknown");
    expect(parseLatestDeploymentState([])).toBe("unknown");
    expect(parseLatestDeploymentState({ message: "x" })).toBe("unknown");
  });

  it("parses deployment list entries", () => {
    expect(
      parseDeployments([
        { id: 1, environment: "prod", ref: "main", created_at: "2026-06-01T00:00:00Z" },
      ]).items,
    ).toHaveLength(1);
  });
});

describe("statistics", () => {
  it("converts commit_activity weeks to ISO dates", () => {
    const weeks = parseCommitActivity([{ total: 7, week: Date.UTC(2026, 5, 14) / 1000, days: [] }]);
    expect(weeks).toEqual([{ weekStart: "2026-06-14", commits: 7 }]);
    expect(parseCommitActivity(commitActivityPayload())).toHaveLength(52);
  });

  it("rejects a statistics body that is not a list", () => {
    expect(() => parseCommitActivity({})).toThrow(UnexpectedResponseError);
  });

  it("derives trailing-90-day commits from weekly buckets and skips deleted accounts", () => {
    const contributors = parseContributorStats(contributorStatsPayload(), NOW);
    expect(contributors.map((c) => c.login)).toEqual(["sample-dev-01", "sample-dev-02"]);
    expect(contributors[0]).toMatchObject({ totalCommits: 120, commitsLast90Days: 8 });
    expect(contributors[1]).toMatchObject({ totalCommits: 30, commitsLast90Days: 0 });
  });

  it("parses the all-time contributor list without a recent-activity breakdown", () => {
    const list = parseContributorList([
      {
        login: "a",
        contributions: 5,
        avatar_url: "https://avatars.githubusercontent.com/u/1",
        html_url: "https://github.com/a",
      },
      { login: null, contributions: 3 },
    ]);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ login: "a", totalCommits: 5, commitsLast90Days: null });
  });
});
