import type {
  HealthIndicator,
  IndicatorStatus,
  Recommendation,
  RepositorySnapshot,
} from "@/lib/domain/types";
import { commitsInTrailingDays, summarizeContributors } from "./contributors";
import { summarizeIssues } from "./issues";
import { summarizePullRequests } from "./pull-requests";
import { summarizeReleases } from "./releases";
import { DEFAULT_THRESHOLDS, type MetricThresholds } from "./thresholds";
import { dataOf, daysBetween } from "./util";
import { summarizeWorkflowRuns } from "./workflows";

const UNKNOWN_MESSAGE = "Not enough data from GitHub to evaluate this.";

function unknownIndicator(
  id: string,
  label: string,
  measures: string,
  limitation: string,
  reason = UNKNOWN_MESSAGE,
): HealthIndicator {
  return { id, label, status: "unknown", value: reason, measures, limitation };
}

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/**
 * Builds the maintenance indicators for one repository. Every indicator states what it measures
 * and what it cannot tell you; indicators without enough data are `unknown`, never silently good.
 */
export function evaluateHealth(
  snapshot: RepositorySnapshot,
  now: Date,
  thresholds: MetricThresholds = DEFAULT_THRESHOLDS,
): HealthIndicator[] {
  return [
    commitActivityIndicator(snapshot, now),
    pullRequestBacklogIndicator(snapshot, now, thresholds),
    issueResponsivenessIndicator(snapshot, now, thresholds),
    ciReliabilityIndicator(snapshot, now),
    releaseCadenceIndicator(snapshot, now, thresholds),
    contributorConcentrationIndicator(snapshot),
  ];
}

function commitActivityIndicator(snapshot: RepositorySnapshot, now: Date): HealthIndicator {
  const id = "commit-activity";
  const label = "Commit activity";
  const measures = "Commits to the default branch in the last 30 days (weekly totals from GitHub).";
  const limitation =
    "Counts commits, not value delivered. Week granularity means the window is approximate.";
  const weeks = dataOf(snapshot.commitActivity);
  if (!weeks) return unknownIndicator(id, label, measures, limitation);

  const commits = commitsInTrailingDays(weeks, now, 30);
  const status: IndicatorStatus = commits >= 8 ? "good" : commits >= 1 ? "warning" : "poor";
  return {
    id,
    label,
    status,
    value: `${commits} commits in the last ~30 days`,
    measures,
    limitation,
  };
}

function pullRequestBacklogIndicator(
  snapshot: RepositorySnapshot,
  now: Date,
  thresholds: MetricThresholds,
): HealthIndicator {
  const id = "pr-backlog";
  const label = "Pull request backlog";
  const measures = `Open pull requests with no activity for ${thresholds.stalePullRequestDays}+ days.`;
  const limitation =
    "Based on the most recent pull requests GitHub returned; a stale PR may be intentionally parked.";
  const prs = dataOf(snapshot.pullRequests);
  if (!prs) return unknownIndicator(id, label, measures, limitation);

  const summary = summarizePullRequests(prs, now, thresholds);
  if (summary.open === 0) {
    return { id, label, status: "good", value: "No open pull requests", measures, limitation };
  }
  const staleShare = summary.stale.length / summary.open;
  const status: IndicatorStatus =
    staleShare <= 0.2 ? "good" : staleShare <= 0.5 ? "warning" : "poor";
  return {
    id,
    label,
    status,
    value: `${summary.stale.length} of ${summary.open} open PRs are stale`,
    measures,
    limitation,
  };
}

function issueResponsivenessIndicator(
  snapshot: RepositorySnapshot,
  now: Date,
  thresholds: MetricThresholds,
): HealthIndicator {
  const id = "issue-responsiveness";
  const label = "Issue responsiveness";
  const measures = `Median time to a first reply from someone other than the author, and open issues idle for ${thresholds.staleIssueDays}+ days.`;
  const limitation =
    "Only issues whose comments were inspected contribute to response time. Bot replies count as replies.";
  const issues = dataOf(snapshot.issues);
  if (!issues) return unknownIndicator(id, label, measures, limitation);

  const summary = summarizeIssues(issues, now, thresholds);
  const { medianHours, sampleSize, awaitingResponse } = summary.firstResponse;
  if (sampleSize === 0 && awaitingResponse === 0) {
    return unknownIndicator(id, label, measures, limitation, "No issues with response data yet.");
  }

  let status: IndicatorStatus = "good";
  if (medianHours !== null) {
    status = medianHours <= 48 ? "good" : medianHours <= 24 * 7 ? "warning" : "poor";
  }
  if (summary.open > 0 && summary.stale.length / summary.open > 0.5) status = "poor";
  else if (awaitingResponse > 3 && status === "good") status = "warning";

  const median =
    medianHours === null
      ? "no responses recorded"
      : `median first reply ${medianHours < 48 ? `${medianHours.toFixed(1)}h` : `${(medianHours / 24).toFixed(1)}d`}`;
  return {
    id,
    label,
    status,
    value: `${median}; ${awaitingResponse} awaiting a reply; ${summary.stale.length} stale`,
    measures,
    limitation,
  };
}

function ciReliabilityIndicator(snapshot: RepositorySnapshot, now: Date): HealthIndicator {
  const id = "ci-reliability";
  const label = "CI reliability";
  const measures = "Share of recent decisive workflow runs (success or failure) that succeeded.";
  const limitation =
    "A passing pipeline says nothing about test coverage, test quality, or production behaviour. Cancelled and skipped runs are excluded.";
  const runs = dataOf(snapshot.workflowRuns);
  if (!runs) return unknownIndicator(id, label, measures, limitation);

  const summary = summarizeWorkflowRuns(runs, now, snapshot.repository.defaultBranch);
  if (summary.successRate === null || summary.decisiveRuns < 5) {
    return unknownIndicator(
      id,
      label,
      measures,
      limitation,
      summary.decisiveRuns === 0
        ? "No completed workflow runs found."
        : `Only ${summary.decisiveRuns} decisive runs — too few to judge.`,
    );
  }
  const status: IndicatorStatus =
    summary.successRate >= 0.9 ? "good" : summary.successRate >= 0.7 ? "warning" : "poor";
  return {
    id,
    label,
    status,
    value: `${pct(summary.successRate)} success over ${summary.decisiveRuns} runs`,
    measures,
    limitation,
  };
}

function releaseCadenceIndicator(
  snapshot: RepositorySnapshot,
  now: Date,
  thresholds: MetricThresholds,
): HealthIndicator {
  const id = "release-cadence";
  const label = "Release cadence";
  const measures = "Days since the latest published GitHub release.";
  const limitation =
    "Only GitHub Releases are counted. Projects that publish via tags or package registries only will show no releases.";
  const releases = dataOf(snapshot.releases);
  if (!releases) return unknownIndicator(id, label, measures, limitation);

  const summary = summarizeReleases(releases, now);
  if (summary.daysSinceLatest === null) {
    return unknownIndicator(id, label, measures, limitation, "No GitHub releases published.");
  }
  const status: IndicatorStatus =
    summary.daysSinceLatest <= thresholds.releaseOverdueDays
      ? "good"
      : summary.daysSinceLatest <= thresholds.releaseOverdueDays * 2
        ? "warning"
        : "poor";
  return {
    id,
    label,
    status,
    value: `Last release ${summary.daysSinceLatest} days ago`,
    measures,
    limitation,
  };
}

function contributorConcentrationIndicator(snapshot: RepositorySnapshot): HealthIndicator {
  const id = "contributor-concentration";
  const label = "Contributor spread";
  const measures = "Share of commits made by the single most active contributor.";
  const limitation =
    "Commit counts are not effort or ownership. A high share can simply mean a small, focused project.";
  const contributors = dataOf(snapshot.contributors);
  if (!contributors) return unknownIndicator(id, label, measures, limitation);

  const summary = summarizeContributors(contributors);
  const top = summary.topContributorShare;
  if (!top || summary.total < 2) {
    return unknownIndicator(id, label, measures, limitation, "Single contributor or no data.");
  }
  const status: IndicatorStatus =
    top.share <= 0.6 ? "good" : top.share <= 0.85 ? "warning" : "poor";
  const window = top.basis === "last_90_days" ? "last 90 days" : "all time";
  return {
    id,
    label,
    status,
    value: `Top contributor made ${pct(top.share)} of commits (${window})`,
    measures,
    limitation,
  };
}

export type HealthLevel = "healthy" | "needs_attention" | "at_risk" | "insufficient_data";

export interface HealthSummary {
  level: HealthLevel;
  label: string;
  counts: Record<IndicatorStatus, number>;
}

/**
 * Rolls indicators up into a coarse level. This is intentionally a count-based summary of the
 * indicators above, not a score: it is "healthy" only if nothing is poor, at most one indicator is
 * a warning, and at least half the indicators had enough data to be evaluated.
 */
export function summarizeHealth(indicators: readonly HealthIndicator[]): HealthSummary {
  const counts: Record<IndicatorStatus, number> = { good: 0, warning: 0, poor: 0, unknown: 0 };
  for (const indicator of indicators) counts[indicator.status] += 1;

  const evaluated = indicators.length - counts.unknown;
  let level: HealthLevel;
  if (evaluated < Math.ceil(indicators.length / 2)) level = "insufficient_data";
  else if (counts.poor >= 2) level = "at_risk";
  else if (counts.poor === 1 || counts.warning >= 2) level = "needs_attention";
  else level = "healthy";

  const labels: Record<HealthLevel, string> = {
    healthy: "No concerns found",
    needs_attention: "Needs attention",
    at_risk: "At risk",
    insufficient_data: "Not enough data",
  };
  return { level, label: labels[level], counts };
}

export function buildRecommendations(
  snapshot: RepositorySnapshot,
  now: Date,
  thresholds: MetricThresholds = DEFAULT_THRESHOLDS,
): Recommendation[] {
  const recommendations: Recommendation[] = [];
  const { repository } = snapshot;

  const prs = dataOf(snapshot.pullRequests);
  if (prs) {
    const summary = summarizePullRequests(prs, now, thresholds);
    if (summary.stale.length > 0) {
      const oldest = summary.stale[0];
      recommendations.push({
        id: "stale-prs",
        severity: summary.stale.length >= 5 ? "warning" : "info",
        title: `Triage ${summary.stale.length} stale pull request${summary.stale.length === 1 ? "" : "s"}`,
        detail: `No activity for ${thresholds.stalePullRequestDays}+ days${oldest ? `; the quietest is #${oldest.number} (${Math.floor(daysBetween(oldest.updatedAt, now))} days)` : ""}. Review, ask for updates, or close them.`,
      });
    }
    if (summary.review.awaitingReview.length > 0) {
      recommendations.push({
        id: "awaiting-review",
        severity: "info",
        title: `${summary.review.awaitingReview.length} ready pull request${summary.review.awaitingReview.length === 1 ? " is" : "s are"} waiting for review`,
        detail:
          "Reviews are the usual bottleneck for merge time. Assign reviewers or set a review rotation.",
      });
    }
  }

  const issues = dataOf(snapshot.issues);
  if (issues) {
    const summary = summarizeIssues(issues, now, thresholds);
    if (summary.firstResponse.awaitingResponse > 0) {
      recommendations.push({
        id: "unanswered-issues",
        severity: summary.firstResponse.awaitingResponse > 5 ? "warning" : "info",
        title: `${summary.firstResponse.awaitingResponse} recent issue${summary.firstResponse.awaitingResponse === 1 ? " has" : "s have"} no reply yet`,
        detail:
          "A short acknowledgement improves contributor experience even when a fix is not planned.",
      });
    }
    if (summary.stale.length >= 5) {
      recommendations.push({
        id: "stale-issues",
        severity: "info",
        title: `Review ${summary.stale.length} issues idle for ${thresholds.staleIssueDays}+ days`,
        detail: "Close, relabel, or ask reporters whether the problem still reproduces.",
      });
    }
  }

  const runs = dataOf(snapshot.workflowRuns);
  if (runs) {
    const summary = summarizeWorkflowRuns(runs, now, repository.defaultBranch);
    if (summary.currentStatus === "failing") {
      recommendations.push({
        id: "ci-failing",
        severity: "critical",
        title: `The latest workflow run on ${repository.defaultBranch} failed`,
        detail: "Investigate before merging more changes. Open the failing run's logs on GitHub.",
      });
    }
    if (summary.successRate !== null && summary.decisiveRuns >= 5 && summary.successRate < 0.8) {
      recommendations.push({
        id: "ci-flaky",
        severity: "warning",
        title: `CI success rate is ${pct(summary.successRate)} over ${summary.decisiveRuns} runs`,
        detail:
          "Frequent failures erode trust in CI. Look for flaky tests or unstable dependencies.",
      });
    }
  }

  const releases = dataOf(snapshot.releases);
  if (releases) {
    const summary = summarizeReleases(releases, now);
    if (
      summary.daysSinceLatest !== null &&
      summary.daysSinceLatest > thresholds.releaseOverdueDays
    ) {
      recommendations.push({
        id: "release-overdue",
        severity: "info",
        title: `No release for ${summary.daysSinceLatest} days`,
        detail:
          "If changes have landed since, consider cutting a release or documenting the cadence.",
      });
    }
  }

  if (!repository.license) {
    recommendations.push({
      id: "no-license",
      severity: "info",
      title: "No license detected",
      detail: "Without a license, others cannot legally reuse or contribute to the code.",
    });
  }

  const order = { critical: 0, warning: 1, info: 2 } as const;
  return recommendations.sort((a, b) => order[a.severity] - order[b.severity]);
}
