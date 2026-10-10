import { CircleDot } from "lucide-react";
import { IssueFlowChart } from "@/components/charts/issue-flow-chart";
import { EmptyState } from "@/components/common/empty-state";
import { Section } from "@/components/common/page-header";
import { StatTile } from "@/components/common/stat-tile";
import { IssueTable } from "@/components/tables/issue-table";
import type { Issue } from "@/lib/domain/types";
import { formatDays, formatHours, formatInteger } from "@/lib/format";
import { summarizeIssues, weeklyIssueFlow } from "@/lib/metrics/issues";
import type { MetricThresholds } from "@/lib/metrics/thresholds";
import { ts } from "@/lib/metrics/util";

const MAX_ROWS = 15;

export function IssueInsights({
  issues,
  now,
  thresholds,
  windowNote,
}: {
  issues: Issue[];
  now: Date;
  thresholds: MetricThresholds;
  windowNote?: string;
}) {
  if (issues.length === 0) {
    return (
      <EmptyState
        icon={CircleDot}
        title="No issues in the loaded data"
        description="Either there are none, or the repository has issues disabled."
      />
    );
  }

  const summary = summarizeIssues(issues, now, thresholds);
  const open = issues
    .filter((issue) => issue.state === "open")
    .sort((a, b) => ts(b.updatedAt) - ts(a.updatedAt));

  return (
    <div className="space-y-6">
      <section aria-label="Issue metrics" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Open issues"
          value={formatInteger(summary.open)}
          caption={windowNote ?? "Pull requests excluded"}
          provenance="github"
          definition={
            <p>
              Issues whose state is open, excluding pull requests (GitHub&apos;s own counter
              includes them).
            </p>
          }
        />
        <StatTile
          label="Stale open issues"
          value={formatInteger(summary.stale.length)}
          caption={`No activity for ${summary.staleDays}+ days`}
          tone={summary.stale.length > 0 ? "warning" : "default"}
          provenance="calculated"
          definition={
            <p>
              Open issues whose last update is at least {summary.staleDays} days old. Adjust the
              threshold in Settings.
            </p>
          }
        />
        <StatTile
          label="Median first reply"
          value={formatHours(summary.firstResponse.medianHours)}
          caption={
            summary.firstResponse.sampleSize > 0
              ? `${summary.firstResponse.sampleSize} issues measured · ${summary.firstResponse.awaitingResponse} awaiting a reply`
              : "No replies measured"
          }
          provenance="calculated"
          definition={
            <>
              <p>
                Median time from an issue being opened to the first comment by someone other than
                its author. Bot comments count.
              </p>
              <p>
                Only issues from a recent window have their comments inspected
                {summary.firstResponse.unknown > 0
                  ? `; ${summary.firstResponse.unknown} older issues were not measured`
                  : ""}
                .
              </p>
            </>
          }
        />
        <StatTile
          label="Median time to close"
          value={formatDays(summary.timeToClose.medianDays)}
          caption={
            summary.timeToClose.sampleSize > 0
              ? `${summary.timeToClose.sampleSize} closed issues`
              : "No closed issues to measure"
          }
          provenance="calculated"
          definition={
            <p>
              Median of (closed at − opened at) for issues closed within the loaded data. Issues
              that were closed long ago are not included.
            </p>
          }
        />
      </section>

      <IssueFlowChart weeks={weeklyIssueFlow(issues, now, 12)} windowNote="Last 12 weeks" />

      <Section
        title="Open issues"
        description={`Most recently updated first${open.length > MAX_ROWS ? ` · showing ${MAX_ROWS} of ${open.length}` : ""}.`}
      >
        {open.length === 0 ? (
          <EmptyState
            icon={CircleDot}
            title="Nothing open"
            description="No open issues."
            className="py-8"
          />
        ) : (
          <IssueTable
            issues={open.slice(0, MAX_ROWS)}
            now={now}
            staleDays={thresholds.staleIssueDays}
            caption="Open issues"
          />
        )}
      </Section>
    </div>
  );
}
