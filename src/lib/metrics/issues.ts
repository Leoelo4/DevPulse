import type { Issue } from "@/lib/domain/types";
import { DEFAULT_THRESHOLDS, type MetricThresholds } from "./thresholds";
import { daysBetween, median, MS_PER_HOUR, recentWeekStarts, ts, weekStartUtc } from "./util";

export interface IssueSummary {
  open: number;
  closed: number;
  /** Calculated: open issues with no activity for `staleDays` days. */
  stale: Issue[];
  staleDays: number;
  /**
   * Calculated: opened → first comment from someone other than the author.
   * Only issues whose comment history was inspected contribute (`sampleSize`).
   */
  firstResponse: {
    sampleSize: number;
    medianHours: number | null;
    /** Open issues in the inspected window that have had no response yet. */
    awaitingResponse: number;
    /** Issues whose comment history was not inspected, so no response time could be derived. */
    unknown: number;
  };
  /** Calculated: opened → closed for closed issues in the dataset. */
  timeToClose: { sampleSize: number; medianDays: number | null };
}

export function summarizeIssues(
  issues: readonly Issue[],
  now: Date,
  thresholds: Pick<MetricThresholds, "staleIssueDays"> = DEFAULT_THRESHOLDS,
): IssueSummary {
  const open = issues.filter((issue) => issue.state === "open");
  const closed = issues.filter((issue) => issue.state === "closed");

  const stale = open
    .filter((issue) => daysBetween(issue.updatedAt, now) >= thresholds.staleIssueDays)
    .sort((a, b) => ts(a.updatedAt) - ts(b.updatedAt));

  const responseHours: number[] = [];
  let awaitingResponse = 0;
  let unknown = 0;
  for (const issue of issues) {
    if (issue.firstResponse.status === "responded") {
      const hours = (ts(issue.firstResponse.at) - ts(issue.createdAt)) / MS_PER_HOUR;
      if (hours >= 0) responseHours.push(hours);
    } else if (issue.firstResponse.status === "none") {
      if (issue.state === "open") awaitingResponse += 1;
    } else {
      unknown += 1;
    }
  }

  const closeDays = closed
    .filter((issue) => issue.closedAt !== null)
    .map((issue) => daysBetween(issue.createdAt, new Date(ts(issue.closedAt as string))))
    .filter((days) => days >= 0);

  return {
    open: open.length,
    closed: closed.length,
    stale,
    staleDays: thresholds.staleIssueDays,
    firstResponse: {
      sampleSize: responseHours.length,
      medianHours: median(responseHours),
      awaitingResponse,
      unknown,
    },
    timeToClose: { sampleSize: closeDays.length, medianDays: median(closeDays) },
  };
}

export interface WeeklyIssueFlow {
  weekStart: string;
  opened: number;
  closed: number;
}

/** Calculated: issues opened and closed per UTC week (Sunday start) for the trailing `weeks` weeks. */
export function weeklyIssueFlow(
  issues: readonly Issue[],
  now: Date,
  weeks = 12,
): WeeklyIssueFlow[] {
  const starts = recentWeekStarts(now, weeks);
  const buckets = new Map<string, WeeklyIssueFlow>(
    starts.map((weekStart) => [weekStart, { weekStart, opened: 0, closed: 0 }]),
  );

  for (const issue of issues) {
    const opened = buckets.get(weekStartUtc(new Date(issue.createdAt)));
    if (opened) opened.opened += 1;
    if (issue.closedAt) {
      const closed = buckets.get(weekStartUtc(new Date(issue.closedAt)));
      if (closed) closed.closed += 1;
    }
  }

  return starts.map((weekStart) => buckets.get(weekStart) as WeeklyIssueFlow);
}
