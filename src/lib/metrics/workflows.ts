import type { WorkflowConclusion, WorkflowRun } from "@/lib/domain/types";
import { daysBetween, isoDate, median, ratio, recentDays, ts } from "./util";

const FAILURE_CONCLUSIONS: ReadonlySet<WorkflowConclusion> = new Set([
  "failure",
  "timed_out",
  "startup_failure",
]);

export function isFailure(run: WorkflowRun): boolean {
  return (
    run.status === "completed" && run.conclusion !== null && FAILURE_CONCLUSIONS.has(run.conclusion)
  );
}

export function isSuccess(run: WorkflowRun): boolean {
  return run.status === "completed" && run.conclusion === "success";
}

/** Runs that produced a pass/fail signal. Cancelled, skipped and neutral runs say nothing about reliability. */
export function isDecisive(run: WorkflowRun): boolean {
  return isSuccess(run) || isFailure(run);
}

export type CiStatus = "passing" | "failing" | "running" | "no_runs";

/**
 * Current state of each workflow on `branch` (or any branch when omitted), then combined:
 * any workflow whose latest decisive run failed → "failing"; otherwise any workflow with a newer
 * run still executing → "running"; otherwise "passing".
 *
 * This is a point-in-time signal about recent workflow runs, NOT a statement about the
 * repository's health, test coverage, or production behaviour.
 */
export function latestCiStatus(runs: readonly WorkflowRun[], branch?: string): CiStatus {
  const scoped = branch ? runs.filter((run) => run.branch === branch) : runs;
  if (scoped.length === 0) return "no_runs";

  const byWorkflow = new Map<string, WorkflowRun[]>();
  for (const run of scoped) {
    const group = byWorkflow.get(run.name);
    if (group) group.push(run);
    else byWorkflow.set(run.name, [run]);
  }

  const states: Array<"passing" | "failing" | "running"> = [];
  for (const group of byWorkflow.values()) {
    const newestFirst = [...group].sort((a, b) => ts(b.createdAt) - ts(a.createdAt));
    const decisive = newestFirst.find(isDecisive);
    const newest = newestFirst[0];
    if (
      newest &&
      newest.status !== "completed" &&
      (!decisive || ts(newest.createdAt) > ts(decisive.createdAt))
    ) {
      states.push("running");
    } else if (decisive) {
      states.push(isSuccess(decisive) ? "passing" : "failing");
    }
  }

  if (states.length === 0) return "no_runs";
  if (states.includes("failing")) return "failing";
  if (states.includes("running")) return "running";
  return "passing";
}

export interface WorkflowSummary {
  totalRuns: number;
  decisiveRuns: number;
  successes: number;
  failures: number;
  /** Calculated: successes / (successes + failures) across the runs in the dataset. */
  successRate: number | null;
  failuresLast7Days: number;
  failuresLast30Days: number;
  /** Calculated from `updatedAt - startedAt`; see `WorkflowRun.durationSeconds`. */
  medianDurationSeconds: number | null;
  currentStatus: CiStatus;
  perWorkflow: WorkflowBreakdown[];
}

export interface WorkflowBreakdown {
  name: string;
  runs: number;
  failures: number;
  failureRate: number | null;
  latestConclusion: WorkflowConclusion | "in_progress" | null;
  medianDurationSeconds: number | null;
  lastRunAt: string;
}

export function summarizeWorkflowRuns(
  runs: readonly WorkflowRun[],
  now: Date,
  defaultBranch?: string,
): WorkflowSummary {
  const decisive = runs.filter(isDecisive);
  const failures = decisive.filter(isFailure);
  const durations = runs
    .filter((run) => run.status === "completed" && run.durationSeconds !== null)
    .map((run) => run.durationSeconds as number);
  // Prefer the default branch; fall back to any branch when it has no runs in the dataset.
  const onDefaultBranch = defaultBranch ? latestCiStatus(runs, defaultBranch) : "no_runs";
  const currentStatus = onDefaultBranch === "no_runs" ? latestCiStatus(runs) : onDefaultBranch;

  return {
    totalRuns: runs.length,
    decisiveRuns: decisive.length,
    successes: decisive.length - failures.length,
    failures: failures.length,
    successRate: ratio(decisive.length - failures.length, decisive.length),
    failuresLast7Days: failures.filter((run) => daysBetween(run.createdAt, now) <= 7).length,
    failuresLast30Days: failures.filter((run) => daysBetween(run.createdAt, now) <= 30).length,
    medianDurationSeconds: median(durations),
    currentStatus,
    perWorkflow: breakdownByWorkflow(runs),
  };
}

function breakdownByWorkflow(runs: readonly WorkflowRun[]): WorkflowBreakdown[] {
  const groups = new Map<string, WorkflowRun[]>();
  for (const run of runs) {
    const group = groups.get(run.name);
    if (group) group.push(run);
    else groups.set(run.name, [run]);
  }

  return [...groups.entries()]
    .map(([name, group]) => {
      const newestFirst = [...group].sort((a, b) => ts(b.createdAt) - ts(a.createdAt));
      const decisive = group.filter(isDecisive);
      const failed = decisive.filter(isFailure);
      const latest = newestFirst[0] as WorkflowRun;
      const durations = group
        .filter((run) => run.status === "completed" && run.durationSeconds !== null)
        .map((run) => run.durationSeconds as number);
      return {
        name,
        runs: group.length,
        failures: failed.length,
        failureRate: ratio(failed.length, decisive.length),
        latestConclusion:
          latest.status === "completed" ? latest.conclusion : ("in_progress" as const),
        medianDurationSeconds: median(durations),
        lastRunAt: latest.createdAt,
      };
    })
    .sort((a, b) => ts(b.lastRunAt) - ts(a.lastRunAt));
}

export interface DailyRunOutcome {
  date: string;
  success: number;
  failure: number;
}

/** Calculated: decisive workflow outcomes per UTC day for the trailing `days` days. */
export function dailyRunOutcomes(
  runs: readonly WorkflowRun[],
  now: Date,
  days = 30,
): DailyRunOutcome[] {
  const buckets = new Map<string, DailyRunOutcome>(
    recentDays(now, days).map((date) => [date, { date, success: 0, failure: 0 }]),
  );
  for (const run of runs) {
    const bucket = buckets.get(isoDate(run.createdAt));
    if (!bucket) continue;
    if (isSuccess(run)) bucket.success += 1;
    else if (isFailure(run)) bucket.failure += 1;
  }
  return [...buckets.values()];
}
