import { FolderGit2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ContributionChart } from "@/components/charts/contribution-chart";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { AggregateValue, aggregateCaption, StatTile } from "@/components/common/stat-tile";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { DataFreshness } from "@/components/dashboard/data-freshness";
import { HealthSummaryCard } from "@/components/dashboard/health-summary-card";
import {
  RecentlyActiveCard,
  RecentReleasesCard,
} from "@/components/dashboard/release-and-activity-cards";
import { Button } from "@/components/ui/button";
import { loadDashboard } from "@/lib/data/load";
import { pluralize } from "@/lib/format";
import { buildOverview } from "@/lib/metrics/overview";

export const metadata: Metadata = { title: "Overview" };

export default async function OverviewPage() {
  const { viewer, now, thresholds, snapshots } = await loadDashboard();

  if (snapshots.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Overview" />
        <EmptyState
          icon={FolderGit2}
          title="No repositories selected"
          description="Choose the repositories you want DevPulse to track and your dashboard will fill in."
          action={
            <Button asChild>
              <Link href="/settings">Choose repositories</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const overview = buildOverview(snapshots, now, thresholds);
  const fetchedAt = snapshots[0]?.meta.fetchedAt ?? now.toISOString();
  const coverage = overview.contributionActivity;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        description={`Activity and maintenance signals across ${pluralize(overview.repositoryCount, "selected repository", "selected repositories")}.`}
        actions={<DataFreshness mode={viewer.mode} fetchedAt={fetchedAt} now={now} />}
      />

      <section aria-label="Key metrics" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile
          label="Repositories"
          value={overview.repositoryCount}
          caption="Selected for tracking"
          provenance="github"
          definition={<p>The repositories you chose to track. Change them in Settings.</p>}
        />
        <StatTile
          label="Open pull requests"
          value={<AggregateValue aggregate={overview.openPullRequests} />}
          caption={aggregateCaption(overview.openPullRequests) ?? "Drafts included"}
          provenance="github"
          definition={
            <p>
              Pull requests currently open, counting drafts, summed across the repositories where
              GitHub returned pull request data. Based on the most recently updated pull requests
              per repository.
            </p>
          }
        />
        <StatTile
          label="Open issues"
          value={<AggregateValue aggregate={overview.openIssues} />}
          caption={aggregateCaption(overview.openIssues) ?? "Pull requests excluded"}
          provenance="github"
          definition={
            <p>
              Open issues, excluding pull requests. GitHub&apos;s own &ldquo;open issues&rdquo;
              counter mixes pull requests in; DevPulse counts issues only.
            </p>
          }
        />
        <StatTile
          label="Workflow failures · 7 days"
          value={<AggregateValue aggregate={overview.workflowFailuresLast7Days} />}
          caption={aggregateCaption(overview.workflowFailuresLast7Days) ?? "Any branch"}
          tone={overview.workflowFailuresLast7Days.value > 0 ? "danger" : "default"}
          provenance="calculated"
          definition={
            <>
              <p>
                Completed workflow runs from the last 7 days that failed, timed out, or failed to
                start, on any branch. Cancelled and skipped runs are not counted.
              </p>
              <p>One broken branch that keeps re-running can inflate this number.</p>
            </>
          }
        />
        <StatTile
          label="Releases · 30 days"
          value={<AggregateValue aggregate={overview.releasesLast30Days} />}
          caption={aggregateCaption(overview.releasesLast30Days) ?? "Published GitHub Releases"}
          provenance="calculated"
          definition={
            <p>
              Non-draft GitHub Releases published in the last 30 days. Tags without a release are
              not counted.
            </p>
          }
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-3" aria-label="Activity and health">
        <div className="lg:col-span-2">
          <ContributionChart
            weeks={coverage.weeks}
            title="Contribution activity"
            description="Commits per week, last 26 weeks"
            coverageNote={
              coverage.coveredRepos < coverage.totalRepos
                ? `Based on ${coverage.coveredRepos} of ${coverage.totalRepos} repositories`
                : undefined
            }
          />
        </div>
        <HealthSummaryCard rows={overview.health} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2" aria-label="Releases and active repositories">
        <RecentReleasesCard releases={overview.recentReleases} now={now} />
        <RecentlyActiveCard repos={overview.recentlyActive} now={now} />
      </section>

      <ActivityFeed events={overview.activity} now={now} />
    </div>
  );
}
