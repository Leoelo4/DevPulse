/**
 * Tunable cut-offs used by calculated metrics. They are product defaults, not GitHub values,
 * and the UI always labels metrics that depend on them as "calculated".
 */
export interface MetricThresholds {
  /** An open pull request with no activity for this many days is considered stale. */
  stalePullRequestDays: number;
  /** An open issue with no activity for this many days is considered stale. */
  staleIssueDays: number;
  /** A repository with releases but none for this many days is flagged as overdue. */
  releaseOverdueDays: number;
}

export const DEFAULT_THRESHOLDS: MetricThresholds = {
  stalePullRequestDays: 14,
  staleIssueDays: 30,
  releaseOverdueDays: 90,
};

export const THRESHOLD_LIMITS = {
  stalePullRequestDays: { min: 1, max: 365 },
  staleIssueDays: { min: 1, max: 365 },
  releaseOverdueDays: { min: 7, max: 730 },
} as const satisfies Record<keyof MetricThresholds, { min: number; max: number }>;
