/** Realistic GitHub API payloads (trimmed to the fields DevPulse reads). All names are fictional. */

import { NOW, daysAgo, hoursAgo } from "./builders";

export const OWNER = "sample-org";
export const REPO = "sample-repo";
export const BASE = `/repos/${OWNER}/${REPO}`;

export const repoPayload = (overrides: Record<string, unknown> = {}) => ({
  id: 4242,
  name: REPO,
  full_name: `${OWNER}/${REPO}`,
  owner: { login: OWNER },
  description: "A sample repository",
  html_url: `https://github.com/${OWNER}/${REPO}`,
  language: "TypeScript",
  stargazers_count: 12,
  forks_count: 3,
  open_issues_count: 7,
  private: false,
  archived: false,
  fork: false,
  default_branch: "main",
  license: { spdx_id: "MIT", name: "MIT License" },
  topics: ["sample"],
  created_at: daysAgo(400),
  updated_at: daysAgo(1),
  pushed_at: hoursAgo(5),
  ...overrides,
});

export const pullPayload = (n: number, overrides: Record<string, unknown> = {}) => ({
  number: n,
  title: `Pull request ${n}`,
  html_url: `https://github.com/${OWNER}/${REPO}/pull/${n}`,
  user: { login: "sample-dev-01" },
  state: "open",
  draft: false,
  created_at: daysAgo(3),
  updated_at: daysAgo(1),
  closed_at: null,
  merged_at: null,
  labels: [{ name: "enhancement" }],
  requested_reviewers: [],
  requested_teams: [],
  ...overrides,
});

export const issuePayload = (n: number, overrides: Record<string, unknown> = {}) => ({
  number: n,
  title: `Issue ${n}`,
  html_url: `https://github.com/${OWNER}/${REPO}/issues/${n}`,
  user: { login: "sample-user-01" },
  state: "open",
  created_at: daysAgo(5),
  updated_at: daysAgo(2),
  closed_at: null,
  comments: 1,
  labels: [{ name: "bug" }],
  ...overrides,
});

export const commentPayload = (issueNumber: number, login: string, createdAt: string) => ({
  issue_url: `https://api.github.com${BASE}/issues/${issueNumber}`,
  user: { login },
  created_at: createdAt,
});

export const runPayload = (id: number, overrides: Record<string, unknown> = {}) => ({
  id,
  name: "CI",
  run_number: id,
  html_url: `https://github.com/${OWNER}/${REPO}/actions/runs/${id}`,
  head_branch: "main",
  event: "push",
  status: "completed",
  conclusion: "success",
  created_at: hoursAgo(10),
  run_started_at: hoursAgo(10),
  updated_at: hoursAgo(9.9),
  actor: { login: "sample-dev-01" },
  ...overrides,
});

export const releasePayload = (id: number, overrides: Record<string, unknown> = {}) => ({
  id,
  tag_name: `v1.${id}.0`,
  name: `Release ${id}`,
  html_url: `https://github.com/${OWNER}/${REPO}/releases/tag/v1.${id}.0`,
  published_at: daysAgo(10),
  prerelease: false,
  draft: false,
  author: { login: "sample-dev-01" },
  ...overrides,
});

export const commitActivityPayload = () =>
  Array.from({ length: 52 }, (_, i) => ({
    total: i % 5,
    week: Math.floor((NOW.getTime() - (51 - i) * 7 * 86_400_000) / 1000),
    days: [0, 0, 0, 0, 0, 0, 0],
  }));

export const contributorStatsPayload = () => [
  {
    total: 120,
    weeks: [{ w: Math.floor(daysAgoMs(10) / 1000), a: 0, d: 0, c: 8 }],
    author: {
      login: "sample-dev-01",
      avatar_url: "https://avatars.githubusercontent.com/u/1",
      html_url: "https://github.com/sample-dev-01",
    },
  },
  {
    total: 30,
    weeks: [{ w: Math.floor(daysAgoMs(200) / 1000), a: 0, d: 0, c: 30 }],
    author: {
      login: "sample-dev-02",
      avatar_url: "https://avatars.githubusercontent.com/u/2",
      html_url: "https://github.com/sample-dev-02",
    },
  },
  { total: 5, weeks: [], author: null },
];

function daysAgoMs(days: number): number {
  return NOW.getTime() - days * 86_400_000;
}

/** Routes for a healthy repository; tests override individual entries. */
export function healthyRepoRoutes() {
  return {
    [`GET ${BASE}`]: { body: repoPayload() },
    [`GET ${BASE}/pulls`]: {
      body: [
        pullPayload(10),
        pullPayload(9, { draft: true }),
        pullPayload(8, {
          state: "closed",
          merged_at: hoursAgo(30),
          closed_at: hoursAgo(30),
          created_at: hoursAgo(80),
        }),
      ],
    },
    [`GET ${BASE}/pulls/10/reviews`]: {
      body: [{ user: { login: "sample-dev-02" }, state: "APPROVED", submitted_at: hoursAgo(20) }],
    },
    [`GET ${BASE}/issues`]: {
      body: [
        issuePayload(3),
        issuePayload(2, { created_at: daysAgo(90), updated_at: daysAgo(80) }),
        // GitHub's issues endpoint also returns pull requests; DevPulse must drop them.
        { ...issuePayload(10), pull_request: { url: "x" } },
      ],
    },
    [`GET ${BASE}/issues/comments`]: {
      body: [commentPayload(3, "sample-dev-02", hoursAgo(100))],
    },
    [`GET ${BASE}/actions/runs`]: {
      body: {
        total_count: 2,
        workflow_runs: [runPayload(2), runPayload(1, { conclusion: "failure" })],
      },
    },
    [`GET ${BASE}/releases`]: {
      body: [releasePayload(2), releasePayload(1, { published_at: daysAgo(40) })],
    },
    [`GET ${BASE}/tags`]: { body: [{ name: "v1.2.0", commit: { sha: "abcdef1234567890" } }] },
    [`GET ${BASE}/deployments`]: {
      body: [{ id: 77, environment: "production", ref: "main", created_at: daysAgo(2) }],
    },
    [`GET ${BASE}/deployments/77/statuses`]: { body: [{ state: "success" }] },
    [`GET ${BASE}/stats/commit_activity`]: { body: commitActivityPayload() },
    [`GET ${BASE}/stats/contributors`]: { body: contributorStatsPayload() },
  };
}
