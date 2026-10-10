import { GitPullRequest } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CoverageNotices } from "@/components/common/coverage-notices";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { RepoScopeSelect } from "@/components/common/repo-scope-select";
import { DataFreshness } from "@/components/dashboard/data-freshness";
import { PullRequestInsights } from "@/components/insights/pull-request-insights";
import { Button } from "@/components/ui/button";
import { loadDashboard } from "@/lib/data/load";
import { scopeSnapshots } from "@/lib/repos/scope";

export const metadata: Metadata = { title: "Pull requests" };

export default async function PullRequestsPage({ searchParams }: PageProps<"/pull-requests">) {
  const { viewer, now, thresholds, snapshots } = await loadDashboard();
  const { selected, repo } = scopeSnapshots(snapshots, (await searchParams).repo);

  if (snapshots.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Pull request insights" />
        <EmptyState
          icon={GitPullRequest}
          title="No repositories selected"
          description="Choose repositories to see pull request throughput, age and review status."
          action={
            <Button asChild>
              <Link href="/onboarding">Choose repositories</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const rows = selected.flatMap((snapshot) =>
    snapshot.pullRequests.status === "ok"
      ? snapshot.pullRequests.data.map((pr) => ({ pr, repoFullName: snapshot.repository.fullName }))
      : [],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pull request insights"
        description="Throughput, age, time to merge and review status. Values GitHub reports directly are labelled “From GitHub”; everything derived by DevPulse is labelled “Calculated”."
        actions={
          <>
            <DataFreshness
              mode={viewer.mode}
              fetchedAt={selected[0]?.meta.fetchedAt ?? now.toISOString()}
              now={now}
            />
            <RepoScopeSelect repos={snapshots.map((s) => s.repository)} value={repo} />
          </>
        }
      />

      <CoverageNotices snapshots={selected} pick={(s) => s.pullRequests} label="Pull requests" />

      <PullRequestInsights
        rows={rows}
        now={now}
        thresholds={thresholds}
        windowNote={selected.length === 1 ? undefined : `${selected.length} repositories`}
      />
    </div>
  );
}
