/**
 * DevPulse domain model.
 *
 * These types are the contract between data sources (demo fixtures, the GitHub API client)
 * and everything downstream (metrics, UI). They are plain JSON-serialisable shapes: dates are
 * ISO-8601 strings so values can cross the server/client component boundary unchanged.
 *
 * Fields that GitHub does not always provide are modelled explicitly (`null`, or a `Resource`
 * wrapper) so the UI can say "unavailable" instead of silently showing zero.
 */

export type DataMode = "demo" | "live";

export interface RepoRef {
  owner: string;
  name: string;
}

export interface Repository {
  id: number;
  owner: string;
  name: string;
  fullName: string;
  description: string | null;
  /** Link to the repository on GitHub. `null` for sample data, which has no GitHub counterpart. */
  htmlUrl: string | null;
  primaryLanguage: string | null;
  stars: number;
  forks: number;
  /** GitHub's `open_issues_count`. NOTE: GitHub includes open pull requests in this number. */
  openIssuesAndPullsCount: number;
  isPrivate: boolean;
  isArchived: boolean;
  isFork: boolean;
  defaultBranch: string;
  license: string | null;
  topics: string[];
  createdAt: string;
  updatedAt: string;
  pushedAt: string | null;
}

export type ReviewState =
  "approved" | "changes_requested" | "review_requested" | "commented" | "no_reviews";

export interface PullRequest {
  number: number;
  title: string;
  htmlUrl: string | null;
  author: string | null;
  state: "open" | "closed";
  merged: boolean;
  draft: boolean;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  mergedAt: string | null;
  labels: string[];
  /** Number of individual reviewers + teams currently requested. */
  requestedReviewerCount: number;
  /**
   * Derived from the pull request's reviews. `null` means reviews were not fetched for this
   * pull request (for example because the per-repository review budget was exhausted).
   */
  reviewState: ReviewState | null;
}

export type FirstResponse =
  | { status: "responded"; at: string }
  | { status: "none" }
  /** The comment history needed to determine this was not fetched (outside the sampled window). */
  | { status: "unknown" };

export interface Issue {
  number: number;
  title: string;
  htmlUrl: string | null;
  author: string | null;
  state: "open" | "closed";
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  commentCount: number;
  labels: string[];
  firstResponse: FirstResponse;
}

export type WorkflowRunStatus =
  "queued" | "in_progress" | "completed" | "waiting" | "requested" | "pending";

export type WorkflowConclusion =
  | "success"
  | "failure"
  | "cancelled"
  | "skipped"
  | "timed_out"
  | "neutral"
  | "action_required"
  | "stale"
  | "startup_failure";

export interface WorkflowRun {
  id: number;
  name: string;
  runNumber: number;
  htmlUrl: string | null;
  branch: string | null;
  event: string;
  status: WorkflowRunStatus;
  conclusion: WorkflowConclusion | null;
  createdAt: string;
  /** When the run started executing, if GitHub reports it. */
  startedAt: string | null;
  updatedAt: string;
  /**
   * Approximation: `updatedAt - startedAt` for completed runs. GitHub's run object has no
   * authoritative duration field, and re-runs and queue time can distort this value.
   */
  durationSeconds: number | null;
  actor: string | null;
}

export interface Release {
  id: number;
  tagName: string;
  name: string | null;
  htmlUrl: string | null;
  publishedAt: string | null;
  prerelease: boolean;
  draft: boolean;
  author: string | null;
}

export interface Tag {
  name: string;
  /** Short commit SHA. */
  sha: string;
}

export type DeploymentState =
  "success" | "failure" | "error" | "in_progress" | "queued" | "pending" | "inactive" | "unknown";

export interface Deployment {
  id: number;
  environment: string;
  ref: string;
  createdAt: string;
  state: DeploymentState;
}

export interface Contributor {
  login: string;
  avatarUrl: string | null;
  htmlUrl: string | null;
  totalCommits: number;
  /** Commits in the trailing 90 days, or `null` when the source only provides all-time totals. */
  commitsLast90Days: number | null;
}

export interface WeeklyCommits {
  /** ISO date (YYYY-MM-DD) of the Sunday that starts the week (GitHub's convention). */
  weekStart: string;
  commits: number;
}

/* -------------------------------------------------------------------------- */
/* Availability                                                                */
/* -------------------------------------------------------------------------- */

export type UnavailableReason =
  "forbidden" | "not_found" | "rate_limited" | "disabled" | "unauthorized" | "error";

/**
 * Wraps any dataset that may be absent or incomplete. UI code must handle all three cases;
 * there is deliberately no way to read `data` without checking `status`.
 */
export type Resource<T> =
  | {
      status: "ok";
      data: T;
      /**
       * `false` when the dataset is a truncated or sampled view of what GitHub holds (for example
       * the most recent 300 pull requests). `note` then explains the limit in plain language.
       */
      complete: boolean;
      note?: string;
    }
  /** GitHub is still computing this (e.g. statistics endpoints answer 202 on first request). */
  | { status: "pending"; message: string }
  | { status: "unavailable"; reason: UnavailableReason; message: string };

export type RepositoryAccess =
  | { status: "ok" }
  /** The repository itself could not be read; `repository` on the snapshot is a bare placeholder. */
  | { status: "unavailable"; reason: UnavailableReason; message: string };

export interface SnapshotMeta {
  mode: DataMode;
  /** ISO timestamp of when the underlying data was fetched or generated. */
  fetchedAt: string;
  /** Plain-language limits that apply to this snapshot, shown alongside metrics that depend on them. */
  caveats: string[];
  access: RepositoryAccess;
}

/** Everything DevPulse knows about one repository at one point in time. */
export interface RepositorySnapshot {
  repository: Repository;
  pullRequests: Resource<PullRequest[]>;
  issues: Resource<Issue[]>;
  workflowRuns: Resource<WorkflowRun[]>;
  releases: Resource<Release[]>;
  tags: Resource<Tag[]>;
  deployments: Resource<Deployment[]>;
  contributors: Resource<Contributor[]>;
  commitActivity: Resource<WeeklyCommits[]>;
  meta: SnapshotMeta;
}

/* -------------------------------------------------------------------------- */
/* Derived / calculated shapes (produced by lib/metrics)                       */
/* -------------------------------------------------------------------------- */

export type IndicatorStatus = "good" | "warning" | "poor" | "unknown";

export interface HealthIndicator {
  id: string;
  label: string;
  status: IndicatorStatus;
  /** Human-readable value, e.g. "4 of 19 open PRs are stale". */
  value: string;
  /** What this indicator actually measures. */
  measures: string;
  /** What it does *not* tell you, so a green tick is never over-read. */
  limitation: string;
}

export interface Recommendation {
  id: string;
  severity: "info" | "warning" | "critical";
  title: string;
  detail: string;
}

export type ActivityKind =
  | "pull_request_opened"
  | "pull_request_merged"
  | "pull_request_closed"
  | "issue_opened"
  | "issue_closed"
  | "workflow_failed"
  | "release_published";

export interface ActivityEvent {
  id: string;
  kind: ActivityKind;
  repoFullName: string;
  title: string;
  actor: string | null;
  at: string;
  htmlUrl: string | null;
}
