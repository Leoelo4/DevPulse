import type {
  Contributor,
  Deployment,
  DeploymentState,
  Issue,
  PullRequest,
  Release,
  Repository,
  RepositorySnapshot,
  ReviewState,
  Tag,
  WeeklyCommits,
  WorkflowConclusion,
  WorkflowRun,
} from "@/lib/domain/types";
import { MS_PER_DAY, MS_PER_HOUR, recentWeekStarts } from "@/lib/metrics/util";
import { createRng, hashSeed, type Rng } from "./prng";
import { DEMO_OWNER, DEMO_PROFILES, type DemoProfile } from "./profiles";

export const DEMO_CAVEATS = [
  "This is generated sample data. It is not fetched from GitHub and does not describe any real repository, person, or organisation.",
];

const FEATURE_TITLES = [
  "Add cursor-based pagination to list endpoints",
  "Support custom date ranges in exports",
  "Introduce retry with exponential backoff",
  "Add keyboard shortcuts for common actions",
  "Cache expensive lookups per request",
  "Add structured logging with request IDs",
  "Support configuration via environment variables",
  "Add health check endpoint",
  "Introduce feature flags for gradual rollout",
  "Add CSV export for reports",
  "Support dark mode in the settings page",
  "Add rate limiting middleware",
];
const FIX_TITLES = [
  "Fix off-by-one error in page boundaries",
  "Handle empty responses without throwing",
  "Prevent duplicate submissions on slow networks",
  "Correct timezone handling for scheduled jobs",
  "Fix memory growth in long-running workers",
  "Resolve flaky timing assertion in tests",
  "Escape user input in error messages",
  "Fix incorrect sort order for ties",
];
const CHORE_TITLES = [
  "Bump dependencies to latest patch versions",
  "Refactor config loading into a single module",
  "Improve README setup instructions",
  "Tighten lint rules and fix violations",
  "Remove unused helper functions",
  "Add missing type annotations",
  "Update CI cache keys",
  "Document release process",
];
const ISSUE_TITLES = [
  "Intermittent timeout when loading large lists",
  "Unclear error message on invalid configuration",
  "Request: support for custom themes",
  "Documentation is missing for the retry settings",
  "Unexpected result when two filters are combined",
  "Slow startup on cold cache",
  "Export includes deleted items",
  "Add option to disable telemetry",
  "Inconsistent date formatting across pages",
  "Crash when input contains emoji",
];
const LABELS = [
  "bug",
  "enhancement",
  "documentation",
  "good first issue",
  "help wanted",
  "dependencies",
];
const BRANCH_PREFIXES = ["feat", "fix", "chore", "docs"];
const EVENTS = ["push", "pull_request", "pull_request", "push", "schedule", "workflow_dispatch"];

interface GenContext {
  rng: Rng;
  now: number;
  profile: DemoProfile;
  logins: string[];
  loginWeights: number[];
}

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

function pickLogin(ctx: GenContext): string {
  const total = ctx.loginWeights.reduce((sum, w) => sum + w, 0);
  let roll = ctx.rng.next() * total;
  for (let i = 0; i < ctx.logins.length; i += 1) {
    roll -= ctx.loginWeights[i] ?? 0;
    if (roll <= 0) return ctx.logins[i] as string;
  }
  return ctx.logins[0] as string;
}

function buildLogins(profile: DemoProfile): { logins: string[]; weights: number[] } {
  const logins = Array.from(
    { length: profile.contributorCount },
    (_, i) => `sample-dev-${String(i + 1).padStart(2, "0")}`,
  );
  const rest = profile.contributorCount - 1;
  const weights = logins.map((_, i) =>
    i === 0
      ? profile.topContributorShare
      : (1 - profile.topContributorShare) * (0.7 ** i / sumGeometric(rest)),
  );
  return { logins, weights };
}

function sumGeometric(count: number): number {
  let sum = 0;
  for (let i = 1; i <= count; i += 1) sum += 0.7 ** i;
  return sum;
}

/** Generates a self-consistent, deterministic snapshot of every sample repository. */
export function generateDemoSnapshots(now: Date): RepositorySnapshot[] {
  return DEMO_PROFILES.map((profile, index) => generateSnapshot(profile, index, now));
}

export function generateDemoSnapshot(
  owner: string,
  name: string,
  now: Date,
): RepositorySnapshot | null {
  if (owner !== DEMO_OWNER) return null;
  const index = DEMO_PROFILES.findIndex((p) => p.name === name);
  const profile = DEMO_PROFILES[index];
  return profile ? generateSnapshot(profile, index, now) : null;
}

function generateSnapshot(profile: DemoProfile, index: number, now: Date): RepositorySnapshot {
  const { logins, weights } = buildLogins(profile);
  const ctx: GenContext = {
    rng: createRng(hashSeed(`${DEMO_OWNER}/${profile.name}`)),
    now: now.getTime(),
    profile,
    logins,
    loginWeights: weights,
  };

  const pullRequests = generatePullRequests(ctx);
  const issues = generateIssues(ctx);
  const workflowRuns = generateWorkflowRuns(ctx);
  const releases = generateReleases(ctx);
  const tags = generateTags(releases, ctx);
  const deployments = generateDeployments(ctx);
  const contributors = generateContributors(ctx);
  const commitActivity = generateCommitActivity(ctx, now);

  const openPrs = pullRequests.filter((pr) => pr.state === "open").length;
  const openIssues = issues.filter((issue) => issue.state === "open").length;
  const latestPush = Math.min(ctx.now - ctx.rng.float(0.2, 2) * MS_PER_DAY, ctx.now);

  const repository: Repository = {
    id: 9_000_000 + index,
    owner: DEMO_OWNER,
    name: profile.name,
    fullName: `${DEMO_OWNER}/${profile.name}`,
    description: profile.description,
    htmlUrl: null,
    primaryLanguage: profile.language,
    stars: profile.stars,
    forks: profile.forks,
    openIssuesAndPullsCount: openPrs + openIssues,
    isPrivate: false,
    isArchived: Boolean(profile.archived),
    isFork: false,
    defaultBranch: "main",
    license: profile.license,
    topics: profile.topics,
    createdAt: iso(ctx.now - (500 + index * 90) * MS_PER_DAY),
    updatedAt: iso(latestPush),
    pushedAt: iso(latestPush),
  };

  return {
    repository,
    pullRequests: {
      status: "ok",
      data: pullRequests,
      complete: true,
      note: "Sample data covers the most recent 120 days.",
    },
    issues: {
      status: "ok",
      data: issues,
      complete: true,
      note: "Sample data covers the most recent 120 days. Reply times are only available for the last 30 days.",
    },
    workflowRuns: {
      status: "ok",
      data: workflowRuns,
      complete: true,
      note: "Sample data covers the most recent 30 days.",
    },
    releases: { status: "ok", data: releases, complete: true },
    tags: { status: "ok", data: tags, complete: true },
    deployments: profile.deploys
      ? { status: "ok", data: deployments, complete: true }
      : {
          status: "unavailable",
          reason: "disabled",
          message: "This sample repository does not use GitHub Deployments.",
        },
    contributors: { status: "ok", data: contributors, complete: true },
    commitActivity: { status: "ok", data: commitActivity, complete: true },
    meta: {
      mode: "demo",
      fetchedAt: now.toISOString(),
      caveats: DEMO_CAVEATS,
      access: { status: "ok" },
    },
  };
}

function reviewStateFor(ctx: GenContext): ReviewState {
  const { review } = ctx.profile;
  const roll = ctx.rng.next();
  if (roll < review.approved) return "approved";
  if (roll < review.approved + review.changesRequested) return "changes_requested";
  if (roll < review.approved + review.changesRequested + review.requested)
    return "review_requested";
  if (roll < review.approved + review.changesRequested + review.requested + review.commented)
    return "commented";
  return "no_reviews";
}

function generatePullRequests(ctx: GenContext): PullRequest[] {
  const { rng, now, profile } = ctx;
  const windowDays = 120;
  const total = Math.max(4, Math.round(profile.prsPerWeek * (windowDays / 7)));
  const drafts: Array<Omit<PullRequest, "number">> = [];

  const make = (createdMs: number, kind: "recent" | "stale"): Omit<PullRequest, "number"> => {
    const ageDays = (now - createdMs) / MS_PER_DAY;
    const draft = kind === "recent" && rng.chance(0.12);
    const author = pickLogin(ctx);
    const title = rng.pick([...FEATURE_TITLES, ...FIX_TITLES, ...CHORE_TITLES]);
    const labels = rng.chance(0.6) ? [rng.pick(LABELS)] : [];

    const openProbability = kind === "stale" ? 1 : ageDays < 5 ? 0.65 : ageDays < 21 ? 0.12 : 0.015;
    const isOpen = rng.chance(openProbability);

    if (isOpen) {
      const idleFloorDays = kind === "stale" ? rng.float(16, Math.min(70, ageDays)) : 0;
      const updatedMs =
        kind === "stale"
          ? now - idleFloorDays * MS_PER_DAY
          : createdMs + rng.float(0, ageDays) * MS_PER_DAY;
      const reviewState = draft ? ("no_reviews" as const) : reviewStateFor(ctx);
      return {
        title,
        htmlUrl: null,
        author,
        state: "open",
        merged: false,
        draft,
        createdAt: iso(createdMs),
        updatedAt: iso(Math.min(updatedMs, now)),
        closedAt: null,
        mergedAt: null,
        labels,
        requestedReviewerCount: reviewState === "review_requested" ? rng.int(1, 2) : 0,
        reviewState,
      };
    }

    if (rng.chance(0.86)) {
      const mergedMs = Math.min(
        createdMs + rng.logNormal(profile.medianMergeHours, 0.9) * MS_PER_HOUR,
        now - MS_PER_HOUR,
      );
      const safeMerged = Math.max(mergedMs, createdMs + 0.2 * MS_PER_HOUR);
      return {
        title,
        htmlUrl: null,
        author,
        state: "closed",
        merged: true,
        draft: false,
        createdAt: iso(createdMs),
        updatedAt: iso(safeMerged),
        closedAt: iso(safeMerged),
        mergedAt: iso(safeMerged),
        labels,
        requestedReviewerCount: 0,
        reviewState: "approved",
      };
    }

    const closedMs = Math.min(createdMs + rng.float(1, 10) * MS_PER_DAY, now - MS_PER_HOUR);
    return {
      title,
      htmlUrl: null,
      author,
      state: "closed",
      merged: false,
      draft: false,
      createdAt: iso(createdMs),
      updatedAt: iso(Math.max(closedMs, createdMs)),
      closedAt: iso(Math.max(closedMs, createdMs)),
      mergedAt: null,
      labels,
      requestedReviewerCount: 0,
      reviewState: "commented",
    };
  };

  for (let i = 0; i < total; i += 1) {
    drafts.push(make(now - rng.float(0.1, windowDays) * MS_PER_DAY, "recent"));
  }
  for (let i = 0; i < profile.stalePullRequests; i += 1) {
    drafts.push(make(now - rng.float(30, 100) * MS_PER_DAY, "stale"));
  }

  drafts.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  return drafts
    .map((draft, i) => ({ number: 100 + i, ...draft }))
    .sort((a, b) => b.number - a.number);
}

function generateIssues(ctx: GenContext): Issue[] {
  const { rng, now, profile } = ctx;
  const windowDays = 120;
  const total = Math.max(3, Math.round(profile.issuesPerWeek * (windowDays / 7)));
  const issues: Array<Omit<Issue, "number">> = [];

  const make = (createdMs: number, stale: boolean): Omit<Issue, "number"> => {
    const ageDays = (now - createdMs) / MS_PER_DAY;
    const withinReplyWindow = ageDays <= 30;
    const replied = rng.chance(profile.issueResponseRate);
    const responseMs = createdMs + rng.logNormal(profile.medianResponseHours, 0.8) * MS_PER_HOUR;
    const canReply = replied && responseMs < now;
    const isOpen = stale ? true : rng.chance(ageDays < 7 ? 0.6 : ageDays < 30 ? 0.2 : 0.05);

    const firstResponse: Issue["firstResponse"] = !withinReplyWindow
      ? { status: "unknown" }
      : canReply
        ? { status: "responded", at: iso(responseMs) }
        : { status: "none" };

    const closedMs = isOpen
      ? null
      : Math.min(createdMs + rng.logNormal(5, 0.9) * MS_PER_DAY, now - MS_PER_HOUR);
    const safeClosedMs =
      closedMs === null ? null : Math.max(closedMs, createdMs + 0.1 * MS_PER_HOUR);
    const updatedMs = isOpen
      ? stale
        ? now - rng.float(profile.staleIssues > 0 ? 31 : 10, Math.max(40, ageDays)) * MS_PER_DAY
        : createdMs + rng.float(0, ageDays) * MS_PER_DAY
      : (safeClosedMs as number);

    return {
      title: rng.pick(ISSUE_TITLES),
      htmlUrl: null,
      author: `sample-user-${String(rng.int(1, 12)).padStart(2, "0")}`,
      state: isOpen ? "open" : "closed",
      createdAt: iso(createdMs),
      updatedAt: iso(Math.min(Math.max(updatedMs, createdMs), now)),
      closedAt: safeClosedMs === null ? null : iso(safeClosedMs),
      commentCount: canReply ? rng.int(1, 6) : 0,
      labels: rng.chance(0.7) ? [rng.pick(LABELS)] : [],
      firstResponse,
    };
  };

  for (let i = 0; i < total; i += 1) {
    issues.push(make(now - rng.float(0.1, windowDays) * MS_PER_DAY, false));
  }
  for (let i = 0; i < profile.staleIssues; i += 1) {
    issues.push(make(now - rng.float(45, windowDays) * MS_PER_DAY, true));
  }

  issues.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  return issues
    .map((issue, i) => ({ number: 20 + i, ...issue }))
    .sort((a, b) => b.number - a.number);
}

function generateWorkflowRuns(ctx: GenContext): WorkflowRun[] {
  const { rng, now, profile } = ctx;
  const days = 30;
  const runs: WorkflowRun[] = [];
  let id = 7_000_000 + (hashSeed(profile.name) % 100_000);
  const counters = new Map<string, number>();

  for (let day = days - 1; day >= 0; day -= 1) {
    const count = Math.max(
      0,
      Math.round(rng.float(profile.runsPerDay * 0.5, profile.runsPerDay * 1.5)),
    );
    for (let n = 0; n < count; n += 1) {
      const workflow = rng.pick(profile.workflows);
      const createdMs = now - day * MS_PER_DAY - rng.float(0, 0.95) * MS_PER_DAY;
      if (createdMs > now - 5 * 60_000) continue;

      const onMain = rng.chance(0.55);
      const failed = rng.chance(workflow.failureRate);
      const conclusion: WorkflowConclusion = failed
        ? "failure"
        : rng.chance(0.04)
          ? "cancelled"
          : "success";
      const duration = Math.max(20, Math.round(rng.logNormal(workflow.medianSeconds, 0.35)));
      const runNumber = (counters.get(workflow.name) ?? 0) + 1;
      counters.set(workflow.name, runNumber);

      runs.push({
        id: id++,
        name: workflow.name,
        runNumber,
        htmlUrl: null,
        branch: onMain
          ? "main"
          : `${rng.pick(BRANCH_PREFIXES)}/${rng.pick(["pagination", "retry", "logging", "exports", "themes"])}`,
        event: onMain ? rng.pick(["push", "schedule"]) : rng.pick(EVENTS),
        status: "completed",
        conclusion,
        createdAt: iso(createdMs),
        startedAt: iso(createdMs + 4000),
        updatedAt: iso(createdMs + (duration + 4) * 1000),
        durationSeconds: duration,
        actor: pickLogin(ctx),
      });
    }
  }

  runs.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  runs.forEach((run, i) => {
    run.runNumber = runs.length - i;
  });

  // Make the headline outcome on the default branch match the profile.
  const latestMain = runs.find(
    (run) => run.branch === "main" && run.name === profile.workflows[0]?.name,
  );
  if (latestMain) {
    latestMain.conclusion = profile.latestMainRun === "failure" ? "failure" : "success";
  }
  return runs;
}

function generateReleases(ctx: GenContext): Release[] {
  const { rng, now, profile } = ctx;
  if (profile.releaseEveryDays === null) return [];
  const releases: Release[] = [];
  let daysAgo = profile.lastReleaseDaysAgo;
  let minor = 8;
  let patch = 0;
  for (let i = 0; i < 9 && daysAgo < 540; i += 1) {
    const prerelease = i === 0 ? false : rng.chance(0.1);
    const tagName = `v1.${minor}.${patch}`;
    releases.push({
      id: 3_000_000 + (hashSeed(profile.name) % 10_000) + i,
      tagName,
      name: tagName,
      htmlUrl: null,
      publishedAt: iso(now - daysAgo * MS_PER_DAY),
      prerelease,
      draft: false,
      author: pickLogin(ctx),
    });
    daysAgo += profile.releaseEveryDays * rng.float(0.7, 1.4);
    if (patch > 0 || rng.chance(0.4)) {
      minor = Math.max(0, minor - 1);
      patch = 0;
    } else {
      patch += 1;
    }
  }
  return releases;
}

function generateTags(releases: Release[], ctx: GenContext): Tag[] {
  const tags: Tag[] = releases.map((release) => ({
    name: release.tagName,
    sha: Math.floor(ctx.rng.next() * 0xfffffff)
      .toString(16)
      .padStart(7, "0"),
  }));
  if (releases.length > 0) {
    tags.push({ name: "v1.0.0", sha: "a1b2c3d" });
  }
  return tags;
}

function generateDeployments(ctx: GenContext): Deployment[] {
  const { rng, now, profile } = ctx;
  if (!profile.deploys) return [];
  const states: DeploymentState[] = [
    "success",
    "success",
    "success",
    "success",
    "failure",
    "inactive",
  ];
  return Array.from({ length: 8 }, (_, i) => ({
    id: 5_000_000 + i,
    environment: i % 3 === 0 ? "staging" : "production",
    ref: "main",
    createdAt: iso(now - (i * 2.4 + rng.float(0.1, 1)) * MS_PER_DAY),
    state: i === 0 ? "success" : rng.pick(states),
  }));
}

function generateContributors(ctx: GenContext): Contributor[] {
  const { rng, profile, logins, loginWeights } = ctx;
  const totalAllTime = Math.round(profile.commitsPerWeek * 52 * 1.8);
  return logins.map((login, i) => {
    const share = loginWeights[i] ?? 0;
    const activeRecently = i < Math.max(2, Math.ceil(logins.length * 0.7));
    return {
      login,
      avatarUrl: null,
      htmlUrl: null,
      totalCommits: Math.max(1, Math.round(totalAllTime * share)),
      commitsLast90Days: activeRecently
        ? Math.max(1, Math.round(profile.commitsPerWeek * 13 * share * rng.float(0.8, 1.2)))
        : 0,
    };
  });
}

function generateCommitActivity(ctx: GenContext, now: Date): WeeklyCommits[] {
  const { rng, profile } = ctx;
  const starts = recentWeekStarts(now, 52);
  return starts.map((weekStart, i) => {
    const progress = i / (starts.length - 1);
    const trend = 1 + (profile.commitTrend - 1) * progress;
    const seasonal = 0.8 + 0.4 * Math.sin(i / 3.2);
    const commits = Math.max(
      0,
      Math.round(profile.commitsPerWeek * trend * seasonal * rng.float(0.6, 1.4)),
    );
    // The current week is still in progress; scale it by how much of it has elapsed.
    const isCurrent = i === starts.length - 1;
    const elapsed = (now.getUTCDay() + 1) / 7;
    return { weekStart, commits: isCurrent ? Math.round(commits * elapsed) : commits };
  });
}
