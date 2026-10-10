import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DataFreshness } from "@/components/dashboard/data-freshness";
import { RepoHeader } from "@/components/repo-detail/repo-header";
import {
  CiPanel,
  ContributorsPanel,
  IssuesPanel,
  OverviewPanel,
  PullRequestsPanel,
  ReleasesPanel,
} from "@/components/repo-detail/repo-panels";
import { parseRepoTab, RepoTabs } from "@/components/repo-detail/repo-tabs";
import { ResourceNotice } from "@/components/common/resource-notice";
import { loadRepository } from "@/lib/data/load";
import { z } from "zod";

/** GitHub owner/repo names: alphanumerics, hyphen, underscore, dot. Reject anything else early. */
const segment = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[A-Za-z0-9._-]+$/);

/** Decodes a URL path segment; malformed percent-encoding yields `null` instead of throwing. */
function decodeSegment(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: PageProps<"/repositories/[owner]/[repo]">): Promise<Metadata> {
  const { owner, repo } = await params;
  return { title: `${decodeSegment(owner) ?? "Repository"}/${decodeSegment(repo) ?? ""}` };
}

export default async function RepositoryPage({
  params,
  searchParams,
}: PageProps<"/repositories/[owner]/[repo]">) {
  const raw = await params;
  const owner = segment.safeParse(decodeSegment(raw.owner));
  const repo = segment.safeParse(decodeSegment(raw.repo));
  if (!owner.success || !repo.success) notFound();

  const tab = parseRepoTab((await searchParams).tab);
  const { snapshot, now, thresholds, viewer } = await loadRepository(owner.data, repo.data);
  if (!snapshot) notFound();

  const panelProps = { snapshot, now, thresholds };
  const basePath = `/repositories/${snapshot.repository.owner}/${snapshot.repository.name}`;

  return (
    <div className="space-y-6">
      <RepoHeader snapshot={snapshot} now={now} />

      {snapshot.meta.access.status === "unavailable" ? (
        <ResourceNotice
          resource={{
            status: "unavailable",
            reason: snapshot.meta.access.reason,
            message: snapshot.meta.access.message,
          }}
          label="Repository"
        />
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <RepoTabs basePath={basePath} active={tab} />
        <DataFreshness mode={viewer.mode} fetchedAt={snapshot.meta.fetchedAt} now={now} />
      </div>

      {tab === "overview" ? <OverviewPanel {...panelProps} /> : null}
      {tab === "pull-requests" ? <PullRequestsPanel {...panelProps} /> : null}
      {tab === "issues" ? <IssuesPanel {...panelProps} /> : null}
      {tab === "ci" ? <CiPanel {...panelProps} /> : null}
      {tab === "releases" ? <ReleasesPanel {...panelProps} /> : null}
      {tab === "contributors" ? <ContributorsPanel {...panelProps} /> : null}
    </div>
  );
}
