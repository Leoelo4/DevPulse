import { Rocket } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CoverageNotices } from "@/components/common/coverage-notices";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader, Section } from "@/components/common/page-header";
import { RepoScopeSelect } from "@/components/common/repo-scope-select";
import { SectionNav } from "@/components/common/section-nav";
import { DataFreshness } from "@/components/dashboard/data-freshness";
import { CiInsights } from "@/components/insights/ci-insights";
import { ReleaseInsights } from "@/components/insights/release-insights";
import { RepoCiTable } from "@/components/insights/repo-ci-table";
import { Button } from "@/components/ui/button";
import { loadDashboard } from "@/lib/data/load";
import { scopeSnapshots } from "@/lib/repos/scope";

export const metadata: Metadata = { title: "CI & releases" };

type View = "ci" | "releases";

function parseView(value: string | string[] | undefined): View {
  return (Array.isArray(value) ? value[0] : value) === "releases" ? "releases" : "ci";
}

export default async function CiReleasesPage({ searchParams }: PageProps<"/ci-releases">) {
  const params = await searchParams;
  const view = parseView(params.view);
  const { viewer, now, snapshots } = await loadDashboard();
  const { selected, repo } = scopeSnapshots(snapshots, params.repo);

  if (snapshots.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="CI & releases" />
        <EmptyState
          icon={Rocket}
          title="No repositories selected"
          description="Choose repositories to see workflow reliability and release history."
          action={
            <Button asChild>
              <Link href="/onboarding">Choose repositories</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const withRepo = repo ? `&repo=${encodeURIComponent(repo)}` : "";
  const runRows = selected.flatMap((snapshot) =>
    snapshot.workflowRuns.status === "ok"
      ? snapshot.workflowRuns.data.map((run) => ({
          run,
          repoFullName: snapshot.repository.fullName,
        }))
      : [],
  );
  const releaseRows = selected.flatMap((snapshot) =>
    snapshot.releases.status === "ok"
      ? snapshot.releases.data.map((release) => ({
          release,
          repoFullName: snapshot.repository.fullName,
        }))
      : [],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="CI & releases"
        description="Workflow outcomes, failure trends and release history. These signals describe pipeline runs and publishing cadence — not overall project quality."
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

      <SectionNav
        label="CI and releases sections"
        active={view}
        items={[
          { id: "ci", label: "CI health", href: `?view=ci${withRepo}` },
          { id: "releases", label: "Releases", href: `?view=releases${withRepo}` },
        ]}
      />

      {view === "ci" ? (
        <div className="space-y-6">
          <CoverageNotices
            snapshots={selected}
            pick={(s) => s.workflowRuns}
            label="Workflow runs"
          />
          {selected.length > 1 ? (
            <Section
              title="Status by repository"
              description="Failing if any workflow's latest result on the default branch failed."
            >
              <RepoCiTable snapshots={selected} now={now} />
            </Section>
          ) : null}
          <CiInsights
            rows={runRows}
            now={now}
            defaultBranch={
              selected.length === 1 ? selected[0]?.repository.defaultBranch : undefined
            }
            windowNote={selected.length === 1 ? undefined : `${selected.length} repositories`}
          />
        </div>
      ) : (
        <div className="space-y-6">
          <CoverageNotices snapshots={selected} pick={(s) => s.releases} label="Releases" />
          <ReleaseInsights
            rows={releaseRows}
            now={now}
            tags={
              selected.length === 1 && selected[0]?.tags.status === "ok"
                ? selected[0].tags.data
                : undefined
            }
            deployments={
              selected.length === 1 && selected[0]?.deployments.status === "ok"
                ? selected[0].deployments.data
                : undefined
            }
            deploymentsNote={
              selected.length === 1 && selected[0]?.deployments.status === "unavailable"
                ? selected[0].deployments.message
                : undefined
            }
          />
        </div>
      )}
    </div>
  );
}
