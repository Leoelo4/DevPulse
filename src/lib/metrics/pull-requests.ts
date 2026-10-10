import type { PullRequest, ReviewState } from "@/lib/domain/types";
import { DEFAULT_THRESHOLDS, type MetricThresholds } from "./thresholds";
import {
  daysBetween,
  median,
  MS_PER_HOUR,
  percentile,
  recentWeekStarts,
  ts,
  weekStartUtc,
} from "./util";

export interface PullRequestSummary {
  /** Counts taken directly from the pull request records GitHub returned. */
  open: number;
  openReady: number;
  openDraft: number;
  merged: number;
  closedUnmerged: number;
  /** Calculated: open pull requests with no activity for `staleDays` days. */
  stale: PullRequest[];
  staleDays: number;
  /** Calculated: age of currently open pull requests, in days. */
  openAge: { medianDays: number | null; oldestDays: number | null };
  /** Calculated: created → merged, for merged pull requests in the dataset. */
  timeToMerge: { sampleSize: number; medianHours: number | null; p90Hours: number | null };
  review: ReviewBreakdown;
}

export interface ReviewBreakdown {
  /** Open, non-draft pull requests grouped by derived review state. */
  counts: Record<ReviewState, number>;
  /** Open, non-draft pull requests whose reviews were not fetched. */
  unknown: number;
  /** Open, non-draft pull requests that still need a first review (none yet, or requested). */
  awaitingReview: PullRequest[];
}

const EMPTY_REVIEW_COUNTS: Record<ReviewState, number> = {
  approved: 0,
  changes_requested: 0,
  review_requested: 0,
  commented: 0,
  no_reviews: 0,
};

export function summarizePullRequests(
  pullRequests: readonly PullRequest[],
  now: Date,
  thresholds: Pick<MetricThresholds, "stalePullRequestDays"> = DEFAULT_THRESHOLDS,
): PullRequestSummary {
  const open = pullRequests.filter((pr) => pr.state === "open");
  const openReady = open.filter((pr) => !pr.draft);
  const merged = pullRequests.filter((pr) => pr.merged);
  const closedUnmerged = pullRequests.filter((pr) => pr.state === "closed" && !pr.merged);

  const stale = open
    .filter((pr) => daysBetween(pr.updatedAt, now) >= thresholds.stalePullRequestDays)
    .sort((a, b) => ts(a.updatedAt) - ts(b.updatedAt));

  const ages = open.map((pr) => daysBetween(pr.createdAt, now));

  const mergeHours = merged
    .filter((pr) => pr.mergedAt !== null)
    .map((pr) => (ts(pr.mergedAt as string) - ts(pr.createdAt)) / MS_PER_HOUR)
    .filter((hours) => hours >= 0);

  return {
    open: open.length,
    openReady: openReady.length,
    openDraft: open.length - openReady.length,
    merged: merged.length,
    closedUnmerged: closedUnmerged.length,
    stale,
    staleDays: thresholds.stalePullRequestDays,
    openAge: {
      medianDays: median(ages),
      oldestDays: ages.length > 0 ? Math.max(...ages) : null,
    },
    timeToMerge: {
      sampleSize: mergeHours.length,
      medianHours: median(mergeHours),
      p90Hours: percentile(mergeHours, 90),
    },
    review: summarizeReviews(openReady),
  };
}

function summarizeReviews(openReady: readonly PullRequest[]): ReviewBreakdown {
  const counts = { ...EMPTY_REVIEW_COUNTS };
  let unknown = 0;
  const awaitingReview: PullRequest[] = [];

  for (const pr of openReady) {
    if (pr.reviewState === null) {
      unknown += 1;
      continue;
    }
    counts[pr.reviewState] += 1;
    if (pr.reviewState === "no_reviews" || pr.reviewState === "review_requested") {
      awaitingReview.push(pr);
    }
  }

  awaitingReview.sort((a, b) => ts(a.createdAt) - ts(b.createdAt));
  return { counts, unknown, awaitingReview };
}

export interface WeeklyPullRequestFlow {
  weekStart: string;
  opened: number;
  merged: number;
  closedUnmerged: number;
}

/**
 * Calculated: pull requests opened / merged / closed-without-merging per UTC week (Sunday start)
 * for the trailing `weeks` weeks. Events outside the window are ignored.
 */
export function weeklyPullRequestFlow(
  pullRequests: readonly PullRequest[],
  now: Date,
  weeks = 12,
): WeeklyPullRequestFlow[] {
  const starts = recentWeekStarts(now, weeks);
  const buckets = new Map<string, WeeklyPullRequestFlow>(
    starts.map((weekStart) => [weekStart, { weekStart, opened: 0, merged: 0, closedUnmerged: 0 }]),
  );

  for (const pr of pullRequests) {
    const opened = buckets.get(weekStartUtc(new Date(pr.createdAt)));
    if (opened) opened.opened += 1;

    if (pr.mergedAt) {
      const bucket = buckets.get(weekStartUtc(new Date(pr.mergedAt)));
      if (bucket) bucket.merged += 1;
    } else if (pr.state === "closed" && pr.closedAt) {
      const bucket = buckets.get(weekStartUtc(new Date(pr.closedAt)));
      if (bucket) bucket.closedUnmerged += 1;
    }
  }

  return starts.map((weekStart) => buckets.get(weekStart) as WeeklyPullRequestFlow);
}

export type AgeBucketId = "lt3d" | "3to7d" | "1to2w" | "2to4w" | "gt4w";

export interface AgeBucket {
  id: AgeBucketId;
  label: string;
  count: number;
}

/** Calculated: distribution of open pull request ages. */
export function openPullRequestAgeBuckets(
  pullRequests: readonly PullRequest[],
  now: Date,
): AgeBucket[] {
  const buckets: AgeBucket[] = [
    { id: "lt3d", label: "< 3 days", count: 0 },
    { id: "3to7d", label: "3–7 days", count: 0 },
    { id: "1to2w", label: "1–2 weeks", count: 0 },
    { id: "2to4w", label: "2–4 weeks", count: 0 },
    { id: "gt4w", label: "> 4 weeks", count: 0 },
  ];

  for (const pr of pullRequests) {
    if (pr.state !== "open") continue;
    const age = daysBetween(pr.createdAt, now);
    const index = age < 3 ? 0 : age < 7 ? 1 : age < 14 ? 2 : age < 28 ? 3 : 4;
    (buckets[index] as AgeBucket).count += 1;
  }
  return buckets;
}
