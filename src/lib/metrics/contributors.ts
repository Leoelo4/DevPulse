import type { Contributor, WeeklyCommits } from "@/lib/domain/types";
import { MS_PER_WEEK, ratio, ts } from "./util";

export interface ContributorSummary {
  total: number;
  /** Contributors with commits in the trailing 90 days, or `null` when the source cannot say. */
  activeLast90Days: number | null;
  /**
   * Calculated: share of commits made by the single most active contributor. Uses 90-day commits
   * when available and all-time commits otherwise (`basis` says which).
   */
  topContributorShare: { login: string; share: number; basis: "last_90_days" | "all_time" } | null;
}

export function summarizeContributors(contributors: readonly Contributor[]): ContributorSummary {
  const hasRecent =
    contributors.length > 0 && contributors.every((c) => c.commitsLast90Days !== null);
  const basis = hasRecent ? ("last_90_days" as const) : ("all_time" as const);
  const countOf = (c: Contributor) => (hasRecent ? (c.commitsLast90Days ?? 0) : c.totalCommits);

  const totalCommits = contributors.reduce((sum, c) => sum + countOf(c), 0);
  const top = [...contributors].sort((a, b) => countOf(b) - countOf(a))[0];
  const share = top ? ratio(countOf(top), totalCommits) : null;

  return {
    total: contributors.length,
    activeLast90Days: hasRecent
      ? contributors.filter((c) => (c.commitsLast90Days ?? 0) > 0).length
      : null,
    topContributorShare: top && share !== null ? { login: top.login, share, basis } : null,
  };
}

export interface CommitMomentum {
  /** Commits in the most recent 4 complete-or-current weeks of the dataset. */
  recent: number;
  /** Commits in the 4 weeks before that. */
  previous: number;
  /** Relative change, or `null` when the previous period had no commits. */
  changeRatio: number | null;
  direction: "up" | "down" | "flat";
}

/**
 * Calculated: compares the latest 4 weeks of commit activity with the 4 weeks before. Uses GitHub's
 * weekly totals, so it covers the default branch only and the current week may be incomplete.
 */
export function commitMomentum(weeks: readonly WeeklyCommits[]): CommitMomentum | null {
  if (weeks.length < 8) return null;
  const ordered = [...weeks].sort((a, b) => ts(a.weekStart) - ts(b.weekStart));
  const sum = (slice: WeeklyCommits[]) => slice.reduce((total, w) => total + w.commits, 0);
  const recent = sum(ordered.slice(-4));
  const previous = sum(ordered.slice(-8, -4));
  const changeRatio = previous === 0 ? null : (recent - previous) / previous;

  let direction: CommitMomentum["direction"] = "flat";
  if (changeRatio === null) direction = recent > 0 ? "up" : "flat";
  else if (changeRatio > 0.1) direction = "up";
  else if (changeRatio < -0.1) direction = "down";

  return { recent, previous, changeRatio, direction };
}

/** Commits in the weeks that start within the trailing `days` days (week granularity). */
export function commitsInTrailingDays(
  weeks: readonly WeeklyCommits[],
  now: Date,
  days: number,
): number {
  const cutoff = now.getTime() - days * (MS_PER_WEEK / 7);
  return weeks
    .filter((week) => ts(week.weekStart) + MS_PER_WEEK > cutoff)
    .reduce((total, week) => total + week.commits, 0);
}
