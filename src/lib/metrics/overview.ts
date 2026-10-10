import type {
  ActivityEvent,
  HealthIndicator,
  Release,
  RepositorySnapshot,
  WeeklyCommits,
} from "@/lib/domain/types";
import { evaluateHealth, summarizeHealth, type HealthSummary } from "./health";
import { DEFAULT_THRESHOLDS, type MetricThresholds } from "./thresholds";
import { dataOf, daysBetween, isPartial, MS_PER_DAY, recentWeekStarts, ts } from "./util";
import { isFailure, latestCiStatus, type CiStatus } from "./workflows";

/**
 * A figure summed across repositories. `coveredRepos < totalRepos` means some repositories could
 * not contribute (missing permission, rate limit, still computing), and `exact: false` means at
 * least one contributing dataset was truncated, so the figure is a lower bound.
 */
export interface Aggregate {
  value: number;
  coveredRepos: number;
  totalRepos: number;
  exact: boolean;
}

function aggregate(
  snapshots: readonly RepositorySnapshot[],
  pick: (snapshot: RepositorySnapshot) => { value: number; partial: boolean } | undefined,
): Aggregate {
  let value = 0;
  let covered = 0;
  let exact = true;
  for (const snapshot of snapshots) {
    const picked = pick(snapshot);
    if (!picked) continue;
    covered += 1;
    value += picked.value;
    if (picked.partial) exact = false;
  }
  return { value, coveredRepos: covered, totalRepos: snapshots.length, exact };
}

export interface RecentRelease {
  repoFullName: string;
  release: Release;
}

export interface RepositoryHealthRow {
  repoFullName: string;
  owner: string;
  name: string;
  summary: HealthSummary;
  indicators: HealthIndicator[];
  ciStatus: CiStatus | "unknown";
}

export interface OverviewMetrics {
  repositoryCount: number;
  openPullRequests: Aggregate;
  openIssues: Aggregate;
  workflowFailuresLast7Days: Aggregate;
  releasesLast30Days: Aggregate;
  recentReleases: RecentRelease[];
  /** Weekly commit totals summed across repositories that reported commit activity. */
  contributionActivity: { weeks: WeeklyCommits[]; coveredRepos: number; totalRepos: number };
  health: RepositoryHealthRow[];
  recentlyActive: { repoFullName: string; lastActivityAt: string }[];
  activity: ActivityEvent[];
}

export function buildOverview(
  snapshots: readonly RepositorySnapshot[],
  now: Date,
  thresholds: MetricThresholds = DEFAULT_THRESHOLDS,
): OverviewMetrics {
  const openPullRequests = aggregate(snapshots, ({ pullRequests }) =>
    pullRequests.status === "ok"
      ? {
          value: pullRequests.data.filter((pr) => pr.state === "open").length,
          partial: isPartial(pullRequests),
        }
      : undefined,
  );

  const openIssues = aggregate(snapshots, ({ issues }) =>
    issues.status === "ok"
      ? {
          value: issues.data.filter((issue) => issue.state === "open").length,
          partial: isPartial(issues),
        }
      : undefined,
  );

  const workflowFailuresLast7Days = aggregate(snapshots, ({ workflowRuns }) =>
    workflowRuns.status === "ok"
      ? {
          value: workflowRuns.data.filter(
            (run) => isFailure(run) && daysBetween(run.createdAt, now) <= 7,
          ).length,
          partial: isPartial(workflowRuns),
        }
      : undefined,
  );

  const releasesLast30Days = aggregate(snapshots, ({ releases }) =>
    releases.status === "ok"
      ? {
          value: releases.data.filter(
            (release) =>
              !release.draft &&
              release.publishedAt !== null &&
              daysBetween(release.publishedAt, now) <= 30,
          ).length,
          partial: isPartial(releases),
        }
      : undefined,
  );

  const recentReleases: RecentRelease[] = snapshots
    .flatMap((snapshot) =>
      (dataOf(snapshot.releases) ?? [])
        .filter((release) => !release.draft && release.publishedAt !== null)
        .map((release) => ({ repoFullName: snapshot.repository.fullName, release })),
    )
    .sort((a, b) => ts(b.release.publishedAt as string) - ts(a.release.publishedAt as string))
    .slice(0, 5);

  return {
    repositoryCount: snapshots.length,
    openPullRequests,
    openIssues,
    workflowFailuresLast7Days,
    releasesLast30Days,
    recentReleases,
    contributionActivity: combineCommitActivity(snapshots, now),
    health: snapshots.map((snapshot) => healthRow(snapshot, now, thresholds)),
    recentlyActive: [...snapshots]
      .map((snapshot) => ({
        repoFullName: snapshot.repository.fullName,
        lastActivityAt: snapshot.repository.pushedAt ?? snapshot.repository.updatedAt,
      }))
      .sort((a, b) => ts(b.lastActivityAt) - ts(a.lastActivityAt))
      .slice(0, 5),
    activity: buildActivityFeed(snapshots, now, 12),
  };
}

function healthRow(
  snapshot: RepositorySnapshot,
  now: Date,
  thresholds: MetricThresholds,
): RepositoryHealthRow {
  const indicators = evaluateHealth(snapshot, now, thresholds);
  const runs = dataOf(snapshot.workflowRuns);
  return {
    repoFullName: snapshot.repository.fullName,
    owner: snapshot.repository.owner,
    name: snapshot.repository.name,
    summary: summarizeHealth(indicators),
    indicators,
    ciStatus: runs ? latestCiStatus(runs, snapshot.repository.defaultBranch) : "unknown",
  };
}

function combineCommitActivity(
  snapshots: readonly RepositorySnapshot[],
  now: Date,
  weeks = 26,
): OverviewMetrics["contributionActivity"] {
  const starts = recentWeekStarts(now, weeks);
  const totals = new Map<string, number>(starts.map((start) => [start, 0]));
  let covered = 0;
  for (const snapshot of snapshots) {
    const activity = dataOf(snapshot.commitActivity);
    if (!activity) continue;
    covered += 1;
    for (const week of activity) {
      if (totals.has(week.weekStart))
        totals.set(week.weekStart, (totals.get(week.weekStart) ?? 0) + week.commits);
    }
  }
  return {
    weeks: starts.map((weekStart) => ({ weekStart, commits: totals.get(weekStart) ?? 0 })),
    coveredRepos: covered,
    totalRepos: snapshots.length,
  };
}

/**
 * Builds a merged, newest-first feed of notable events across repositories. Only events within
 * the datasets GitHub returned can appear, so quiet older events may be missing by design.
 */
export function buildActivityFeed(
  snapshots: readonly RepositorySnapshot[],
  now: Date,
  limit = 20,
  windowDays = 30,
): ActivityEvent[] {
  const cutoff = now.getTime() - windowDays * MS_PER_DAY;
  const events: ActivityEvent[] = [];
  const push = (event: ActivityEvent) => {
    if (ts(event.at) >= cutoff && ts(event.at) <= now.getTime()) events.push(event);
  };

  for (const snapshot of snapshots) {
    const repo = snapshot.repository.fullName;

    for (const pr of dataOf(snapshot.pullRequests) ?? []) {
      push({
        id: `${repo}#pr-opened-${pr.number}`,
        kind: "pull_request_opened",
        repoFullName: repo,
        title: `#${pr.number} ${pr.title}`,
        actor: pr.author,
        at: pr.createdAt,
        htmlUrl: pr.htmlUrl,
      });
      if (pr.mergedAt) {
        push({
          id: `${repo}#pr-merged-${pr.number}`,
          kind: "pull_request_merged",
          repoFullName: repo,
          title: `#${pr.number} ${pr.title}`,
          actor: pr.author,
          at: pr.mergedAt,
          htmlUrl: pr.htmlUrl,
        });
      } else if (pr.closedAt) {
        push({
          id: `${repo}#pr-closed-${pr.number}`,
          kind: "pull_request_closed",
          repoFullName: repo,
          title: `#${pr.number} ${pr.title}`,
          actor: pr.author,
          at: pr.closedAt,
          htmlUrl: pr.htmlUrl,
        });
      }
    }

    for (const issue of dataOf(snapshot.issues) ?? []) {
      push({
        id: `${repo}#issue-opened-${issue.number}`,
        kind: "issue_opened",
        repoFullName: repo,
        title: `#${issue.number} ${issue.title}`,
        actor: issue.author,
        at: issue.createdAt,
        htmlUrl: issue.htmlUrl,
      });
      if (issue.closedAt) {
        push({
          id: `${repo}#issue-closed-${issue.number}`,
          kind: "issue_closed",
          repoFullName: repo,
          title: `#${issue.number} ${issue.title}`,
          actor: null,
          at: issue.closedAt,
          htmlUrl: issue.htmlUrl,
        });
      }
    }

    for (const run of dataOf(snapshot.workflowRuns) ?? []) {
      if (!isFailure(run)) continue;
      push({
        id: `${repo}#run-${run.id}`,
        kind: "workflow_failed",
        repoFullName: repo,
        title: `${run.name} failed${run.branch ? ` on ${run.branch}` : ""}`,
        actor: run.actor,
        at: run.updatedAt,
        htmlUrl: run.htmlUrl,
      });
    }

    for (const release of dataOf(snapshot.releases) ?? []) {
      if (release.draft || !release.publishedAt) continue;
      push({
        id: `${repo}#release-${release.id}`,
        kind: "release_published",
        repoFullName: repo,
        title: release.name ?? release.tagName,
        actor: release.author,
        at: release.publishedAt,
        htmlUrl: release.htmlUrl,
      });
    }
  }

  return events.sort((a, b) => ts(b.at) - ts(a.at)).slice(0, limit);
}
