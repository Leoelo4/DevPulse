import { FolderGit2, SearchX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { DataFreshness } from "@/components/dashboard/data-freshness";
import { RepoFilters } from "@/components/repos/repo-filters";
import { RepoPagination } from "@/components/repos/repo-pagination";
import { RepoTable } from "@/components/repos/repo-table";
import { Button } from "@/components/ui/button";
import { loadDashboard } from "@/lib/data/load";
import { parseRepoQuery, queryRepositories } from "@/lib/repos/query";
import { buildRepositoryRows } from "@/lib/repos/rows";

export const metadata: Metadata = { title: "Repositories" };

export default async function RepositoriesPage({ searchParams }: PageProps<"/repositories">) {
  const query = parseRepoQuery(await searchParams);
  const { viewer, now, thresholds, snapshots } = await loadDashboard();

  const rows = buildRepositoryRows(snapshots, now, thresholds);
  const result = queryRepositories(rows, query);
  const fetchedAt = snapshots[0]?.meta.fetchedAt ?? now.toISOString();

  return (
    <div className="space-y-5">
      <PageHeader
        title="Repositories"
        description="Search, filter and compare the repositories you track. Open one for pull requests, issues, CI runs, releases and maintenance recommendations."
        actions={
          snapshots.length > 0 ? (
            <DataFreshness mode={viewer.mode} fetchedAt={fetchedAt} now={now} />
          ) : undefined
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={FolderGit2}
          title="No repositories selected"
          description="Choose the repositories you want DevPulse to track."
          action={
            <Button asChild>
              <Link href="/settings">Choose repositories</Link>
            </Button>
          }
        />
      ) : (
        <>
          <RepoFilters
            languages={result.languages}
            initial={{
              q: query.q,
              language: query.language,
              health: query.health,
              ci: query.ci,
              size: query.size,
            }}
          />
          {result.total === 0 ? (
            <EmptyState
              icon={SearchX}
              title="No repositories match these filters"
              description="Try a different search term, or clear the filters to see everything you track."
              action={
                <Button asChild variant="outline">
                  <Link href="/repositories">Clear filters</Link>
                </Button>
              }
            />
          ) : (
            <>
              <RepoTable rows={result.rows} query={query} now={now} />
              <RepoPagination
                query={query}
                page={result.page}
                pageCount={result.pageCount}
                total={result.total}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}
