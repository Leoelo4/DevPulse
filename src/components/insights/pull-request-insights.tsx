import { GitPullRequest } from "lucide-react";
import { AgeBucketChart } from "@/components/charts/age-bucket-chart";
import { PullRequestFlowChart } from "@/components/charts/pull-request-flow-chart";
import { EmptyState } from "@/components/common/empty-state";
import { MetricInfo } from "@/components/common/metric-info";
import { Section } from "@/components/common/page-header";
import { Provenance } from "@/components/common/provenance";
import { ReviewBadge } from "@/components/common/status-badge";
import { StatTile } from "@/components/common/stat-tile";
import { PullRequestTable, type PullRequestRow } from "@/components/tables/pull-request-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ReviewState } from "@/lib/domain/types";
import { formatHours, formatInteger } from "@/lib/format";
import type { MetricThresholds } from "@/lib/metrics/thresholds";
import {
  openPullRequestAgeBuckets,
  summarizePullRequests,
  weeklyPullRequestFlow,
} from "@/lib/metrics/pull-requests";
import { ts } from "@/lib/metrics/util";

const REVIEW_ORDER: ReviewState[] = [
  "approved",
  "changes_requested",
  "review_requested",
  "commented",
  "no_reviews",
];

const MAX_ROWS = 15;

/**
 * Pull request analytics for one repository or for several combined. Rows carry their repository
 * name when combined; the metrics themselves only need the pull request records.
 */
export function PullRequestInsights({
  rows,
  now,
  thresholds,
  windowNote,
}: {
  rows: PullRequestRow[];
  now: Date;
  thresholds: MetricThresholds;
  /** Plain-language description of the data window, e.g. "most recent 300 pull requests". */
  windowNote?: string;
}) {
  const prs = rows.map((row) => row.pr);

  if (prs.length === 0) {
    return (
      <EmptyState
        icon={GitPullRequest}
        title="No pull requests in the loaded data"
        description="Either there are none, or none were returned for the repositories selected."
      />
    );
  }

  const summary = summarizePullRequests(prs, now, thresholds);
  // The summary returns the same PullRequest objects it was given, in its own (sorted) order;
  // map them back to table rows so repository names travel with them and the order is kept.
  const rowByPr = new Map(rows.map((row) => [row.pr, row]));
  const rowsFor = (selected: readonly (typeof prs)[number][]): PullRequestRow[] =>
    selected.flatMap((pr) => rowByPr.get(pr) ?? []);

  const open = rows
    .filter(({ pr }) => pr.state === "open")
    .sort((a, b) => ts(b.pr.updatedAt) - ts(a.pr.updatedAt));
  const merged = rows
    .filter(({ pr }) => pr.merged)
    .sort((a, b) => ts(b.pr.mergedAt as string) - ts(a.pr.mergedAt as string));

  const reviewTotal = summary.review.awaitingReview.length;

  return (
    <div className="space-y-6">
      <section
        aria-label="Pull request metrics"
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
      >
        <StatTile
          label="Open"
          value={formatInteger(summary.open)}
          caption={`${summary.openReady} ready for review · ${summary.openDraft} draft`}
          provenance="github"
          definition={
            <p>
              Pull requests whose state is open. Drafts are counted as open but excluded from review
              metrics, since they are not asking for review yet.
            </p>
          }
        />
        <StatTile
          label="Merged"
          value={formatInteger(summary.merged)}
          caption={windowNote ?? "In the loaded data"}
          provenance="github"
          definition={
            <p>
              Pull requests GitHub reports as merged, within the data window DevPulse loaded. This
              is not an all-time total.
            </p>
          }
        />
        <StatTile
          label="Closed unmerged"
          value={formatInteger(summary.closedUnmerged)}
          caption="Abandoned or superseded"
          provenance="github"
          definition={
            <p>Pull requests that were closed without being merged, in the loaded data.</p>
          }
        />
        <StatTile
          label="Median time to merge"
          value={formatHours(summary.timeToMerge.medianHours)}
          caption={
            summary.timeToMerge.sampleSize > 0
              ? `p90 ${formatHours(summary.timeToMerge.p90Hours)} · ${summary.timeToMerge.sampleSize} merged PRs`
              : "No merged pull requests to measure"
          }
          provenance="calculated"
          definition={
            <>
              <p>
                The median of (merged at − opened at) across merged pull requests in the loaded
                data. The p90 is the time within which 90% of them merged.
              </p>
              <p>It includes time a pull request spent as a draft or waiting on others.</p>
            </>
          }
        />
        <StatTile
          label="Stale open PRs"
          value={formatInteger(summary.stale.length)}
          caption={`No activity for ${summary.staleDays}+ days`}
          tone={summary.stale.length > 0 ? "warning" : "default"}
          provenance="calculated"
          definition={
            <p>
              Open pull requests whose last update is at least {summary.staleDays} days old. Change
              the threshold in Settings. A stale pull request is not necessarily abandoned.
            </p>
          }
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-3" aria-label="Pull request charts">
        <div className="lg:col-span-2">
          <PullRequestFlowChart
            weeks={weeklyPullRequestFlow(prs, now, 12)}
            windowNote="Last 12 weeks"
          />
        </div>
        <AgeBucketChart buckets={openPullRequestAgeBuckets(prs, now)} />
      </section>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="flex items-center gap-1.5 text-sm">
              Review status of open pull requests
              <MetricInfo label="Review status">
                <p>
                  Derived from each pull request&apos;s review history: &ldquo;changes
                  requested&rdquo; if any reviewer&apos;s latest review requests changes, otherwise
                  &ldquo;approved&rdquo; if anyone approved. &ldquo;Review requested&rdquo; means
                  reviewers were asked but nobody has reviewed yet.
                </p>
                <p>
                  Reviews are fetched only for open, non-draft pull requests and only up to a
                  per-repository budget. Anything not fetched is shown as &ldquo;not fetched&rdquo;,
                  never guessed.
                </p>
              </MetricInfo>
            </CardTitle>
            <Provenance kind="mixed" />
          </div>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-wrap gap-x-8 gap-y-3">
            {REVIEW_ORDER.map((state) => (
              <li key={state} className="flex items-center gap-2 text-sm">
                <ReviewBadge state={state} />
                <span className="font-semibold tabular-nums">{summary.review.counts[state]}</span>
              </li>
            ))}
            {summary.review.unknown > 0 ? (
              <li className="flex items-center gap-2 text-sm">
                <ReviewBadge state={null} />
                <span className="font-semibold tabular-nums">{summary.review.unknown}</span>
              </li>
            ) : null}
          </ul>
        </CardContent>
      </Card>

      {reviewTotal > 0 ? (
        <Section
          title="Waiting for a first review"
          description="Ready (non-draft) pull requests with no review yet, oldest first."
        >
          <PullRequestTable
            rows={rowsFor(summary.review.awaitingReview).slice(0, MAX_ROWS)}
            now={now}
            staleDays={thresholds.stalePullRequestDays}
            caption="Pull requests waiting for a first review"
          />
        </Section>
      ) : null}

      {summary.stale.length > 0 ? (
        <Section
          title="Stale pull requests"
          description={`Open with no activity for ${summary.staleDays}+ days, quietest first.`}
        >
          <PullRequestTable
            rows={rowsFor(summary.stale).slice(0, MAX_ROWS)}
            now={now}
            staleDays={thresholds.stalePullRequestDays}
            caption="Stale open pull requests"
          />
        </Section>
      ) : null}

      <Section
        title="Open pull requests"
        description={`Most recently updated first${open.length > MAX_ROWS ? ` · showing ${MAX_ROWS} of ${open.length}` : ""}.`}
      >
        {open.length === 0 ? (
          <EmptyState
            icon={GitPullRequest}
            title="Nothing open"
            description="No open pull requests."
            className="py-8"
          />
        ) : (
          <PullRequestTable
            rows={open.slice(0, MAX_ROWS)}
            now={now}
            staleDays={thresholds.stalePullRequestDays}
            caption="Open pull requests"
          />
        )}
      </Section>

      {merged.length > 0 ? (
        <Section
          title="Recently merged"
          description="Latest merged pull requests in the loaded data."
        >
          <PullRequestTable
            rows={merged.slice(0, 8)}
            now={now}
            staleDays={thresholds.stalePullRequestDays}
            caption="Recently merged pull requests"
          />
        </Section>
      ) : null}
    </div>
  );
}
