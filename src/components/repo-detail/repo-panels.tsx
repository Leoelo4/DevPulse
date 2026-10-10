import { Users } from "lucide-react";
import { ContributionChart } from "@/components/charts/contribution-chart";
import { EmptyState } from "@/components/common/empty-state";
import { ResourceNotice } from "@/components/common/resource-notice";
import { StatTile } from "@/components/common/stat-tile";
import { CiInsights } from "@/components/insights/ci-insights";
import { IssueInsights } from "@/components/insights/issue-insights";
import { PullRequestInsights } from "@/components/insights/pull-request-insights";
import { ReleaseInsights } from "@/components/insights/release-insights";
import { ContributorTable } from "@/components/tables/contributor-table";
import type { RepositorySnapshot } from "@/lib/domain/types";
import { formatDays, formatHours, formatPercent } from "@/lib/format";
import { commitMomentum, summarizeContributors } from "@/lib/metrics/contributors";
import { buildRecommendations, evaluateHealth } from "@/lib/metrics/health";
import { summarizeIssues } from "@/lib/metrics/issues";
import { summarizePullRequests } from "@/lib/metrics/pull-requests";
import { summarizeReleases } from "@/lib/metrics/releases";
import type { MetricThresholds } from "@/lib/metrics/thresholds";
import { dataOf } from "@/lib/metrics/util";
import { summarizeWorkflowRuns } from "@/lib/metrics/workflows";
import { HealthIndicators } from "./health-indicators";
import { RecommendationsCard } from "./recommendations-card";

interface PanelProps {
  snapshot: RepositorySnapshot;
  now: Date;
  thresholds: MetricThresholds;
}

export function OverviewPanel({ snapshot, now, thresholds }: PanelProps) {
  const prs = dataOf(snapshot.pullRequests);
  const issues = dataOf(snapshot.issues);
  const runs = dataOf(snapshot.workflowRuns);
  const releases = dataOf(snapshot.releases);
  const commits = dataOf(snapshot.commitActivity);

  const prSummary = prs ? summarizePullRequests(prs, now, thresholds) : null;
  const issueSummary = issues ? summarizeIssues(issues, now, thresholds) : null;
  const ciSummary = runs
    ? summarizeWorkflowRuns(runs, now, snapshot.repository.defaultBranch)
    : null;
  const releaseSummary = releases ? summarizeReleases(releases, now) : null;
  const momentum = commits ? commitMomentum(commits) : null;

  const unavailable = <span aria-label="Unavailable">—</span>;

  return (
    <div className="space-y-6">
      <section
        aria-label="Key metrics"
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
      >
        <StatTile
          label="Open pull requests"
          value={prSummary ? prSummary.open : unavailable}
          caption={prSummary ? `${prSummary.stale.length} stale` : "Data unavailable"}
          provenance="github"
          definition={<p>Pull requests currently open, including drafts.</p>}
        />
        <StatTile
          label="Open issues"
          value={issueSummary ? issueSummary.open : unavailable}
          caption={issueSummary ? `${issueSummary.stale.length} stale` : "Data unavailable"}
          provenance="github"
          definition={<p>Open issues, excluding pull requests.</p>}
        />
        <StatTile
          label="CI success rate"
          value={
            ciSummary?.successRate != null ? formatPercent(ciSummary.successRate) : unavailable
          }
          caption={ciSummary ? `${ciSummary.decisiveRuns} decisive runs` : "Data unavailable"}
          provenance="calculated"
          definition={
            <p>
              Successful workflow runs divided by runs that finished with a clear pass or fail in
              the loaded window. It says nothing about test quality or coverage.
            </p>
          }
        />
        <StatTile
          label="Median time to merge"
          value={prSummary ? formatHours(prSummary.timeToMerge.medianHours) : unavailable}
          caption={
            prSummary ? `${prSummary.timeToMerge.sampleSize} merged PRs` : "Data unavailable"
          }
          provenance="calculated"
          definition={
            <p>Median of (merged at − opened at) across merged pull requests in the loaded data.</p>
          }
        />
        <StatTile
          label="Median first reply"
          value={issueSummary ? formatHours(issueSummary.firstResponse.medianHours) : unavailable}
          caption={
            issueSummary
              ? `${issueSummary.firstResponse.sampleSize} issues measured`
              : "Data unavailable"
          }
          provenance="calculated"
          definition={
            <p>
              Median time to the first comment from someone other than the issue author, for recent
              issues whose comments were inspected.
            </p>
          }
        />
        <StatTile
          label="Last release"
          value={
            releaseSummary?.daysSinceLatest != null
              ? formatDays(releaseSummary.daysSinceLatest)
              : unavailable
          }
          caption={
            releaseSummary
              ? (releaseSummary.latest?.tagName ?? "No published releases")
              : "Data unavailable"
          }
          provenance="calculated"
          definition={<p>Days since the latest published GitHub Release.</p>}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-5" aria-label="Health">
        <div className="lg:col-span-3">
          <HealthIndicators indicators={evaluateHealth(snapshot, now, thresholds)} />
        </div>
        <div className="lg:col-span-2">
          <RecommendationsCard recommendations={buildRecommendations(snapshot, now, thresholds)} />
        </div>
      </section>

      <section className="space-y-3" aria-label="Commit activity">
        {commits ? (
          <>
            <ContributionChart
              weeks={commits}
              title="Commit activity"
              description="Commits per week to the default branch, last 52 weeks"
            />
            {momentum ? (
              <p className="text-xs text-muted-foreground">
                Calculated momentum: {momentum.recent} commits in the last 4 weeks versus{" "}
                {momentum.previous} in the 4 weeks before
                {momentum.changeRatio === null
                  ? "."
                  : ` (${momentum.changeRatio >= 0 ? "+" : ""}${Math.round(momentum.changeRatio * 100)}%).`}{" "}
                The latest week may still be in progress.
              </p>
            ) : null}
          </>
        ) : null}
        <ResourceNotice resource={snapshot.commitActivity} label="Commit activity" />
      </section>
    </div>
  );
}

export function PullRequestsPanel({ snapshot, now, thresholds }: PanelProps) {
  const resource = snapshot.pullRequests;
  return (
    <div className="space-y-4">
      <ResourceNotice resource={resource} label="Pull requests" />
      {resource.status === "ok" ? (
        <PullRequestInsights
          rows={resource.data.map((pr) => ({ pr }))}
          now={now}
          thresholds={thresholds}
          windowNote={resource.note}
        />
      ) : null}
    </div>
  );
}

export function IssuesPanel({ snapshot, now, thresholds }: PanelProps) {
  const resource = snapshot.issues;
  return (
    <div className="space-y-4">
      <ResourceNotice resource={resource} label="Issues" />
      {resource.status === "ok" ? (
        <IssueInsights
          issues={resource.data}
          now={now}
          thresholds={thresholds}
          windowNote={resource.note}
        />
      ) : null}
    </div>
  );
}

export function CiPanel({ snapshot, now }: PanelProps) {
  const resource = snapshot.workflowRuns;
  return (
    <div className="space-y-4">
      <ResourceNotice resource={resource} label="Workflow runs" />
      {resource.status === "ok" ? (
        <CiInsights
          rows={resource.data.map((run) => ({ run }))}
          now={now}
          defaultBranch={snapshot.repository.defaultBranch}
          windowNote={resource.note}
        />
      ) : null}
    </div>
  );
}

export function ReleasesPanel({ snapshot, now }: PanelProps) {
  const { releases, tags, deployments } = snapshot;
  return (
    <div className="space-y-4">
      <ResourceNotice resource={releases} label="Releases" />
      <ResourceNotice resource={tags} label="Tags" />
      {releases.status === "ok" ? (
        <ReleaseInsights
          rows={releases.data.map((release) => ({ release }))}
          now={now}
          tags={tags.status === "ok" ? tags.data : undefined}
          deployments={deployments.status === "ok" ? deployments.data : undefined}
          deploymentsNote={deployments.status === "unavailable" ? deployments.message : undefined}
        />
      ) : null}
    </div>
  );
}

export function ContributorsPanel({ snapshot }: PanelProps) {
  const resource = snapshot.contributors;
  if (resource.status !== "ok") return <ResourceNotice resource={resource} label="Contributors" />;

  if (resource.data.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No contributor data"
        description="GitHub did not return any contributors for this repository."
      />
    );
  }

  const summary = summarizeContributors(resource.data);
  return (
    <div className="space-y-4">
      <ResourceNotice resource={resource} label="Contributors" />
      <section aria-label="Contributor metrics" className="grid gap-3 sm:grid-cols-3">
        <StatTile
          label="Contributors"
          value={summary.total}
          caption="With at least one commit"
          provenance="github"
          definition={<p>People GitHub lists as contributors to the default branch.</p>}
        />
        <StatTile
          label="Active · last 90 days"
          value={summary.activeLast90Days ?? "—"}
          caption={
            summary.activeLast90Days === null
              ? "Recent activity not available"
              : "Contributors with recent commits"
          }
          provenance="calculated"
          definition={<p>Contributors who made at least one commit in the trailing 90 days.</p>}
        />
        <StatTile
          label="Top contributor share"
          value={
            summary.topContributorShare ? formatPercent(summary.topContributorShare.share) : "—"
          }
          caption={
            summary.topContributorShare
              ? `${summary.topContributorShare.login} · ${summary.topContributorShare.basis === "last_90_days" ? "last 90 days" : "all time"}`
              : "Not enough data"
          }
          provenance="calculated"
          definition={
            <>
              <p>The share of commits made by the single most active contributor.</p>
              <p>
                A high share can indicate concentrated knowledge, but it can also simply describe a
                small, focused project. Commit counts are not a measure of effort.
              </p>
            </>
          }
        />
      </section>
      <ContributorTable contributors={resource.data} />
    </div>
  );
}
