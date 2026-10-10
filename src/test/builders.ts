import type {
  Contributor,
  Issue,
  PullRequest,
  Release,
  Repository,
  RepositorySnapshot,
  WorkflowRun,
} from "@/lib/domain/types";

/** Fixed reference time used across tests: Wednesday 2026-06-17 12:00 UTC. */
export const NOW = new Date("2026-06-17T12:00:00.000Z");

export function hoursAgo(hours: number, now: Date = NOW): string {
  return new Date(now.getTime() - hours * 3_600_000).toISOString();
}

export function daysAgo(days: number, now: Date = NOW): string {
  return hoursAgo(days * 24, now);
}

let counter = 0;
const nextId = () => {
  counter += 1;
  return counter;
};

export function pr(overrides: Partial<PullRequest> = {}): PullRequest {
  const number = overrides.number ?? nextId();
  return {
    number,
    title: `PR ${number}`,
    htmlUrl: null,
    author: "sample-dev-01",
    state: "open",
    merged: false,
    draft: false,
    createdAt: daysAgo(2),
    updatedAt: daysAgo(1),
    closedAt: null,
    mergedAt: null,
    labels: [],
    requestedReviewerCount: 0,
    reviewState: "no_reviews",
    ...overrides,
  };
}

export function mergedPr(
  createdHoursAgo: number,
  mergeAfterHours: number,
  overrides: Partial<PullRequest> = {},
) {
  const mergedAt = hoursAgo(createdHoursAgo - mergeAfterHours);
  return pr({
    state: "closed",
    merged: true,
    createdAt: hoursAgo(createdHoursAgo),
    updatedAt: mergedAt,
    closedAt: mergedAt,
    mergedAt,
    reviewState: "approved",
    ...overrides,
  });
}

export function issue(overrides: Partial<Issue> = {}): Issue {
  const number = overrides.number ?? nextId();
  return {
    number,
    title: `Issue ${number}`,
    htmlUrl: null,
    author: "sample-user-01",
    state: "open",
    createdAt: daysAgo(3),
    updatedAt: daysAgo(2),
    closedAt: null,
    commentCount: 0,
    labels: [],
    firstResponse: { status: "unknown" },
    ...overrides,
  };
}

export function run(overrides: Partial<WorkflowRun> = {}): WorkflowRun {
  const id = overrides.id ?? nextId();
  return {
    id,
    name: "CI",
    runNumber: id,
    htmlUrl: null,
    branch: "main",
    event: "push",
    status: "completed",
    conclusion: "success",
    createdAt: daysAgo(1),
    startedAt: daysAgo(1),
    updatedAt: daysAgo(1),
    durationSeconds: 120,
    actor: "sample-dev-01",
    ...overrides,
  };
}

export function release(overrides: Partial<Release> = {}): Release {
  const id = overrides.id ?? nextId();
  return {
    id,
    tagName: `v1.${id}.0`,
    name: null,
    htmlUrl: null,
    publishedAt: daysAgo(10),
    prerelease: false,
    draft: false,
    author: "sample-dev-01",
    ...overrides,
  };
}

export function contributor(overrides: Partial<Contributor> = {}): Contributor {
  return {
    login: `sample-dev-${nextId()}`,
    avatarUrl: null,
    htmlUrl: null,
    totalCommits: 10,
    commitsLast90Days: 5,
    ...overrides,
  };
}

export function repository(overrides: Partial<Repository> = {}): Repository {
  return {
    id: 1,
    owner: "sample-org",
    name: "sample-repo",
    fullName: "sample-org/sample-repo",
    description: null,
    htmlUrl: null,
    primaryLanguage: "TypeScript",
    stars: 0,
    forks: 0,
    openIssuesAndPullsCount: 0,
    isPrivate: false,
    isArchived: false,
    isFork: false,
    defaultBranch: "main",
    license: "MIT",
    topics: [],
    createdAt: daysAgo(400),
    updatedAt: daysAgo(1),
    pushedAt: daysAgo(1),
    ...overrides,
  };
}

const UNAVAILABLE = {
  status: "unavailable",
  reason: "error",
  message: "not provided in this test",
} as const;

/** A snapshot where every dataset is unavailable unless overridden. */
export function snapshot(overrides: Partial<RepositorySnapshot> = {}): RepositorySnapshot {
  return {
    repository: repository(),
    pullRequests: UNAVAILABLE,
    issues: UNAVAILABLE,
    workflowRuns: UNAVAILABLE,
    releases: UNAVAILABLE,
    tags: UNAVAILABLE,
    deployments: UNAVAILABLE,
    contributors: UNAVAILABLE,
    commitActivity: UNAVAILABLE,
    meta: { mode: "demo", fetchedAt: NOW.toISOString(), caveats: [], access: { status: "ok" } },
    ...overrides,
  };
}

export function ok<T>(data: T, complete = true): { status: "ok"; data: T; complete: boolean } {
  return { status: "ok", data, complete };
}
