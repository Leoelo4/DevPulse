import { z } from "zod";
import type {
  Contributor,
  Deployment,
  DeploymentState,
  Issue,
  PullRequest,
  Release,
  Repository,
  Tag,
  WeeklyCommits,
  WorkflowConclusion,
  WorkflowRun,
  WorkflowRunStatus,
} from "@/lib/domain/types";
import { MS_PER_DAY } from "@/lib/metrics/util";
import { UnexpectedResponseError } from "./errors";

/**
 * GitHub API response parsing. Only the fields DevPulse uses are declared; everything else is
 * ignored. Validation is deliberately tolerant about optional/nullable fields (GitHub omits or
 * nulls many of them) and strict about the fields metrics depend on.
 */

const GITHUB_HOSTS = new Set(["github.com", "api.github.com", "avatars.githubusercontent.com"]);

/** Returns `value` only if it is an https URL on a GitHub-owned host; otherwise `null`. */
export function safeGitHubUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && GITHUB_HOSTS.has(url.hostname) ? url.toString() : null;
  } catch {
    return null;
  }
}

const actor = z.object({ login: z.string() }).nullish();
const label = z.union([z.string(), z.object({ name: z.string().nullish() })]);
const iso = z.string().min(10);

function labelNames(labels: Array<z.infer<typeof label>>): string[] {
  return labels
    .map((l) => (typeof l === "string" ? l : (l.name ?? "")))
    .filter((name) => name.length > 0);
}

/** Validates each array element independently; invalid ones are skipped and counted. */
export function parseItems<S extends z.ZodType, T>(
  schema: S,
  raw: unknown,
  map: (item: z.infer<S>) => T,
): { items: T[]; skipped: number } {
  if (!Array.isArray(raw)) throw new UnexpectedResponseError("Expected a list from GitHub.");
  const items: T[] = [];
  let skipped = 0;
  for (const element of raw) {
    const parsed = schema.safeParse(element);
    if (parsed.success) items.push(map(parsed.data));
    else skipped += 1;
  }
  return { items, skipped };
}

/* ------------------------------ repository ------------------------------ */

const repositorySchema = z.object({
  id: z.number(),
  name: z.string(),
  full_name: z.string(),
  owner: z.object({ login: z.string() }),
  description: z.string().nullish(),
  html_url: z.string(),
  language: z.string().nullish(),
  stargazers_count: z.number().default(0),
  forks_count: z.number().default(0),
  open_issues_count: z.number().default(0),
  private: z.boolean().default(false),
  archived: z.boolean().default(false),
  fork: z.boolean().default(false),
  default_branch: z.string().default("main"),
  license: z.object({ spdx_id: z.string().nullish(), name: z.string().nullish() }).nullish(),
  topics: z.array(z.string()).default([]),
  created_at: iso,
  updated_at: iso,
  pushed_at: iso.nullish(),
});

function mapRepository(r: z.infer<typeof repositorySchema>): Repository {
  const spdx = r.license?.spdx_id;
  return {
    id: r.id,
    owner: r.owner.login,
    name: r.name,
    fullName: r.full_name,
    description: r.description ?? null,
    htmlUrl: safeGitHubUrl(r.html_url),
    primaryLanguage: r.language ?? null,
    stars: r.stargazers_count,
    forks: r.forks_count,
    openIssuesAndPullsCount: r.open_issues_count,
    isPrivate: r.private,
    isArchived: r.archived,
    isFork: r.fork,
    defaultBranch: r.default_branch,
    // GitHub reports "NOASSERTION" when it cannot identify a license; treat that as unknown.
    license: spdx && spdx !== "NOASSERTION" ? spdx : (r.license?.name ?? null),
    topics: r.topics,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    pushedAt: r.pushed_at ?? null,
  };
}

export function parseRepository(raw: unknown): Repository {
  const parsed = repositorySchema.safeParse(raw);
  if (!parsed.success)
    throw new UnexpectedResponseError("Repository response had an unexpected shape.");
  return mapRepository(parsed.data);
}

export function parseRepositories(raw: unknown) {
  return parseItems(repositorySchema, raw, mapRepository);
}

/* ---------------------------- pull requests ---------------------------- */

const pullRequestSchema = z.object({
  number: z.number(),
  title: z.string(),
  html_url: z.string(),
  user: actor,
  state: z.enum(["open", "closed"]),
  draft: z.boolean().nullish(),
  created_at: iso,
  updated_at: iso,
  closed_at: iso.nullish(),
  merged_at: iso.nullish(),
  labels: z.array(label).default([]),
  requested_reviewers: z.array(z.unknown()).nullish(),
  requested_teams: z.array(z.unknown()).nullish(),
});

export function parsePullRequests(raw: unknown) {
  return parseItems(pullRequestSchema, raw, (p): PullRequest => ({
    number: p.number,
    title: p.title,
    htmlUrl: safeGitHubUrl(p.html_url),
    author: p.user?.login ?? null,
    state: p.state,
    merged: Boolean(p.merged_at),
    draft: Boolean(p.draft),
    createdAt: p.created_at,
    updatedAt: p.updated_at,
    closedAt: p.closed_at ?? null,
    mergedAt: p.merged_at ?? null,
    labels: labelNames(p.labels),
    requestedReviewerCount: (p.requested_reviewers?.length ?? 0) + (p.requested_teams?.length ?? 0),
    // Filled in later for the open, non-draft pull requests whose reviews are fetched.
    reviewState: null,
  }));
}

/* --------------------------------- issues -------------------------------- */

const issueSchema = z.object({
  number: z.number(),
  title: z.string(),
  html_url: z.string(),
  user: actor,
  state: z.enum(["open", "closed"]),
  created_at: iso,
  updated_at: iso,
  closed_at: iso.nullish(),
  comments: z.number().default(0),
  labels: z.array(label).default([]),
});

/**
 * GitHub's issues endpoint also returns pull requests (they carry a `pull_request` key). Those are
 * removed here so issue counts and response times never include pull requests.
 */
export function parseIssues(raw: unknown) {
  if (!Array.isArray(raw)) throw new UnexpectedResponseError("Expected a list from GitHub.");
  const withoutPulls = raw.filter(
    (item) => !(typeof item === "object" && item !== null && "pull_request" in item),
  );
  return parseItems(issueSchema, withoutPulls, (i): Issue => ({
    number: i.number,
    title: i.title,
    htmlUrl: safeGitHubUrl(i.html_url),
    author: i.user?.login ?? null,
    state: i.state,
    createdAt: i.created_at,
    updatedAt: i.updated_at,
    closedAt: i.closed_at ?? null,
    commentCount: i.comments,
    labels: labelNames(i.labels),
    // Resolved later from the repository's recent comments.
    firstResponse: { status: "unknown" },
  }));
}

export interface ReviewInput {
  reviewer: string | null;
  state: string;
  submittedAt: string | null;
}

const reviewSchema = z.object({
  user: actor,
  state: z.string(),
  submitted_at: iso.nullish(),
});

export function parseReviews(raw: unknown) {
  return parseItems(reviewSchema, raw, (r): ReviewInput => ({
    reviewer: r.user?.login ?? null,
    state: r.state.toUpperCase(),
    submittedAt: r.submitted_at ?? null,
  }));
}

export interface CommentInput {
  issueNumber: number;
  author: string | null;
  createdAt: string;
}

const commentSchema = z.object({
  issue_url: z.string(),
  user: actor,
  created_at: iso,
});

export function parseIssueComments(raw: unknown) {
  const parsed = parseItems(commentSchema, raw, (c) => {
    const tail = c.issue_url.split("/").pop();
    const issueNumber = Number(tail);
    return Number.isInteger(issueNumber)
      ? ({
          issueNumber,
          author: c.user?.login ?? null,
          createdAt: c.created_at,
        } satisfies CommentInput)
      : null;
  });
  return {
    items: parsed.items.filter((c): c is CommentInput => c !== null),
    skipped: parsed.skipped + parsed.items.filter((c) => c === null).length,
  };
}

/* ----------------------------- workflow runs ----------------------------- */

const RUN_STATUSES: readonly WorkflowRunStatus[] = [
  "queued",
  "in_progress",
  "completed",
  "waiting",
  "requested",
  "pending",
];
const RUN_CONCLUSIONS: readonly WorkflowConclusion[] = [
  "success",
  "failure",
  "cancelled",
  "skipped",
  "timed_out",
  "neutral",
  "action_required",
  "stale",
  "startup_failure",
];

const runSchema = z.object({
  id: z.number(),
  name: z.string().nullish(),
  display_title: z.string().nullish(),
  run_number: z.number().default(0),
  html_url: z.string(),
  head_branch: z.string().nullish(),
  event: z.string().default("unknown"),
  status: z.string().nullish(),
  conclusion: z.string().nullish(),
  created_at: iso,
  run_started_at: iso.nullish(),
  updated_at: iso,
  actor: actor,
});

export function parseWorkflowRuns(raw: unknown) {
  return parseItems(runSchema, raw, (r): WorkflowRun => {
    const status = RUN_STATUSES.find((s) => s === r.status) ?? "pending";
    const conclusion = RUN_CONCLUSIONS.find((c) => c === r.conclusion) ?? null;
    const startedAt = r.run_started_at ?? null;
    const duration =
      status === "completed" && startedAt
        ? Math.max(0, Math.round((Date.parse(r.updated_at) - Date.parse(startedAt)) / 1000))
        : null;
    return {
      id: r.id,
      name: r.name ?? r.display_title ?? "Workflow",
      runNumber: r.run_number,
      htmlUrl: safeGitHubUrl(r.html_url),
      branch: r.head_branch ?? null,
      event: r.event,
      status,
      conclusion,
      createdAt: r.created_at,
      startedAt,
      updatedAt: r.updated_at,
      durationSeconds: Number.isFinite(duration) ? duration : null,
      actor: r.actor?.login ?? null,
    };
  });
}

/* ------------------------- releases, tags, deployments ------------------------- */

const releaseSchema = z.object({
  id: z.number(),
  tag_name: z.string(),
  name: z.string().nullish(),
  html_url: z.string(),
  published_at: iso.nullish(),
  prerelease: z.boolean().default(false),
  draft: z.boolean().default(false),
  author: actor,
});

export function parseReleases(raw: unknown) {
  return parseItems(releaseSchema, raw, (r): Release => ({
    id: r.id,
    tagName: r.tag_name,
    name: r.name || null,
    htmlUrl: safeGitHubUrl(r.html_url),
    publishedAt: r.published_at ?? null,
    prerelease: r.prerelease,
    draft: r.draft,
    author: r.author?.login ?? null,
  }));
}

const tagSchema = z.object({ name: z.string(), commit: z.object({ sha: z.string() }) });

export function parseTags(raw: unknown) {
  return parseItems(tagSchema, raw, (t): Tag => ({ name: t.name, sha: t.commit.sha.slice(0, 7) }));
}

const deploymentSchema = z.object({
  id: z.number(),
  environment: z.string(),
  ref: z.string(),
  created_at: iso,
});

export function parseDeployments(raw: unknown) {
  return parseItems(deploymentSchema, raw, (d) => d);
}

const DEPLOYMENT_STATES: readonly DeploymentState[] = [
  "success",
  "failure",
  "error",
  "in_progress",
  "queued",
  "pending",
  "inactive",
];

const deploymentStatusSchema = z.object({ state: z.string() });

/** The latest status of a deployment, or `unknown` when GitHub returned none. */
export function parseLatestDeploymentState(raw: unknown): DeploymentState {
  if (!Array.isArray(raw)) return "unknown";
  const parsed = deploymentStatusSchema.safeParse(raw[0]);
  if (!parsed.success) return "unknown";
  return DEPLOYMENT_STATES.find((s) => s === parsed.data.state) ?? "unknown";
}

export function toDeployment(
  raw: { id: number; environment: string; ref: string; created_at: string },
  state: DeploymentState,
): Deployment {
  return {
    id: raw.id,
    environment: raw.environment,
    ref: raw.ref,
    createdAt: raw.created_at,
    state,
  };
}

/* ------------------------------- statistics ------------------------------- */

const commitActivitySchema = z.object({ total: z.number(), week: z.number() });

export function parseCommitActivity(raw: unknown): WeeklyCommits[] {
  const { items } = parseItems(commitActivitySchema, raw, (w) => ({
    weekStart: new Date(w.week * 1000).toISOString().slice(0, 10),
    commits: w.total,
  }));
  return items;
}

const contributorStatsSchema = z.object({
  total: z.number(),
  weeks: z.array(z.object({ w: z.number(), c: z.number() })).default([]),
  author: z
    .object({ login: z.string(), avatar_url: z.string().nullish(), html_url: z.string().nullish() })
    .nullish(),
});

/** Contributors with per-week activity; `now` anchors the trailing-90-day window. */
export function parseContributorStats(raw: unknown, now: Date): Contributor[] {
  const cutoff = (now.getTime() - 90 * MS_PER_DAY) / 1000;
  const { items } = parseItems(contributorStatsSchema, raw, (c): Contributor | null => {
    if (!c.author) return null; // deleted accounts have no login to show
    return {
      login: c.author.login,
      avatarUrl: safeGitHubUrl(c.author.avatar_url),
      htmlUrl: safeGitHubUrl(c.author.html_url),
      totalCommits: c.total,
      // A week counts if it ends after the cutoff (weeks are 7 days long).
      commitsLast90Days: c.weeks
        .filter((w) => w.w + 7 * 86_400 > cutoff)
        .reduce((sum, w) => sum + w.c, 0),
    };
  });
  return items.filter((c): c is Contributor => c !== null);
}

const contributorListSchema = z.object({
  login: z.string().nullish(),
  avatar_url: z.string().nullish(),
  html_url: z.string().nullish(),
  contributions: z.number(),
});

/** All-time contributor list (no recent-activity breakdown): the fallback when stats are pending. */
export function parseContributorList(raw: unknown): Contributor[] {
  const { items } = parseItems(contributorListSchema, raw, (c): Contributor | null =>
    c.login
      ? {
          login: c.login,
          avatarUrl: safeGitHubUrl(c.avatar_url),
          htmlUrl: safeGitHubUrl(c.html_url),
          totalCommits: c.contributions,
          commitsLast90Days: null,
        }
      : null,
  );
  return items.filter((c): c is Contributor => c !== null);
}
