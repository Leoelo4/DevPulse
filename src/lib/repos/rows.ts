import type { RepositorySnapshot, UnavailableReason } from "@/lib/domain/types";
import { evaluateHealth, summarizeHealth, type HealthLevel } from "@/lib/metrics/health";
import { DEFAULT_THRESHOLDS, type MetricThresholds } from "@/lib/metrics/thresholds";
import { dataOf } from "@/lib/metrics/util";
import { latestCiStatus, type CiStatus } from "@/lib/metrics/workflows";

/** One line of the repository explorer: everything the table and its filters need. */
export interface RepositoryRow {
  owner: string;
  name: string;
  fullName: string;
  description: string | null;
  language: string | null;
  stars: number;
  forks: number;
  isPrivate: boolean;
  isArchived: boolean;
  /** `null` when pull request data is unavailable (never shown as zero). */
  openPullRequests: number | null;
  openIssues: number | null;
  ciStatus: CiStatus | "unknown";
  healthLevel: HealthLevel;
  /** Latest push (or last update when never pushed). */
  lastActivityAt: string;
  htmlUrl: string | null;
  access: { ok: true } | { ok: false; reason: UnavailableReason; message: string };
}

export function buildRepositoryRows(
  snapshots: readonly RepositorySnapshot[],
  now: Date,
  thresholds: MetricThresholds = DEFAULT_THRESHOLDS,
): RepositoryRow[] {
  return snapshots.map((snapshot) => {
    const { repository } = snapshot;
    const pullRequests = dataOf(snapshot.pullRequests);
    const issues = dataOf(snapshot.issues);
    const runs = dataOf(snapshot.workflowRuns);
    const access = snapshot.meta.access;

    return {
      owner: repository.owner,
      name: repository.name,
      fullName: repository.fullName,
      description: repository.description,
      language: repository.primaryLanguage,
      stars: repository.stars,
      forks: repository.forks,
      isPrivate: repository.isPrivate,
      isArchived: repository.isArchived,
      openPullRequests: pullRequests
        ? pullRequests.filter((pr) => pr.state === "open").length
        : null,
      openIssues: issues ? issues.filter((issue) => issue.state === "open").length : null,
      ciStatus: runs ? latestCiStatus(runs, repository.defaultBranch) : "unknown",
      healthLevel: summarizeHealth(evaluateHealth(snapshot, now, thresholds)).level,
      lastActivityAt: repository.pushedAt ?? repository.updatedAt,
      htmlUrl: repository.htmlUrl,
      access:
        access.status === "ok"
          ? { ok: true }
          : { ok: false, reason: access.reason, message: access.message },
    };
  });
}
