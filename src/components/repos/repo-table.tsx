import { ArrowDown, ArrowUp, ArrowUpDown, GitFork, Lock, Star, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { ExternalLink } from "@/components/common/external-link";
import { RelativeTime } from "@/components/common/relative-time";
import { CiStatusBadge, HealthBadge, StatusBadge } from "@/components/common/status-badge";
import { Badge } from "@/components/ui/badge";
import { formatCompact, formatInteger } from "@/lib/format";
import { buildRepoHref, type RepoQuery, type RepoSortKey } from "@/lib/repos/query";
import type { RepositoryRow } from "@/lib/repos/rows";
import { cn } from "@/lib/utils";

function SortHeader({
  label,
  sortKey,
  query,
  align = "left",
}: {
  label: string;
  sortKey: RepoSortKey;
  query: RepoQuery;
  align?: "left" | "right";
}) {
  const active = query.sort === sortKey;
  const nextDir = active && query.dir === "desc" ? "asc" : "desc";
  const Icon = !active ? ArrowUpDown : query.dir === "asc" ? ArrowUp : ArrowDown;

  return (
    <th
      scope="col"
      aria-sort={active ? (query.dir === "asc" ? "ascending" : "descending") : "none"}
      className={cn("px-3 py-2 font-medium whitespace-nowrap", align === "right" && "text-right")}
    >
      <Link
        href={buildRepoHref(query, {
          sort: sortKey,
          dir: sortKey === "name" && !active ? "asc" : nextDir,
          page: 1,
        })}
        className={cn(
          "inline-flex items-center gap-1 rounded-sm hover:text-foreground",
          active ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
        <Icon className="size-3" aria-hidden />
        <span className="sr-only">
          {active
            ? `, sorted ${query.dir === "asc" ? "ascending" : "descending"}`
            : ", activate to sort"}
        </span>
      </Link>
    </th>
  );
}

function Count({ value, label }: { value: number | null; label: string }) {
  if (value === null) {
    return (
      <span className="text-muted-foreground" title={`${label} unavailable`}>
        <span aria-hidden>—</span>
        <span className="sr-only">{label} unavailable</span>
      </span>
    );
  }
  return <>{formatInteger(value)}</>;
}

export function RepoTable({
  rows,
  query,
  now,
}: {
  rows: RepositoryRow[];
  query: RepoQuery;
  now: Date;
}) {
  return (
    <div className="relative overflow-x-auto rounded-xl border bg-card">
      <table className="w-full min-w-[56rem] text-left text-sm">
        <caption className="sr-only">
          Tracked repositories. Column headers are links that change the sort order.
        </caption>
        <thead className="border-b bg-muted/40 text-xs">
          <tr>
            <SortHeader label="Repository" sortKey="name" query={query} />
            <th
              scope="col"
              className="px-3 py-2 font-medium whitespace-nowrap text-muted-foreground"
            >
              Language
            </th>
            <SortHeader label="Stars" sortKey="stars" query={query} align="right" />
            <SortHeader label="Forks" sortKey="forks" query={query} align="right" />
            <SortHeader label="Open PRs" sortKey="prs" query={query} align="right" />
            <SortHeader label="Open issues" sortKey="issues" query={query} align="right" />
            <SortHeader label="Last push" sortKey="updated" query={query} />
            <th
              scope="col"
              className="px-3 py-2 font-medium whitespace-nowrap text-muted-foreground"
            >
              CI
            </th>
            <SortHeader label="Health" sortKey="health" query={query} />
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => (
            <tr key={row.fullName} className="align-top transition-colors hover:bg-muted/30">
              <td className="max-w-80 px-3 py-3">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Link
                    href={`/repositories/${row.owner}/${row.name}`}
                    className="font-medium underline-offset-4 hover:text-primary hover:underline"
                  >
                    <span className="text-muted-foreground">{row.owner}/</span>
                    {row.name}
                  </Link>
                  {row.isPrivate ? (
                    <Badge variant="outline" className="h-4 gap-1 rounded-md px-1.5 text-[10px]">
                      <Lock aria-hidden /> Private
                    </Badge>
                  ) : null}
                  {row.isArchived ? (
                    <Badge variant="outline" className="h-4 rounded-md px-1.5 text-[10px]">
                      Archived
                    </Badge>
                  ) : null}
                  <ExternalLink href={row.htmlUrl} className="text-xs">
                    <span className="sr-only">{row.fullName} on GitHub</span>
                  </ExternalLink>
                </div>
                {row.access.ok ? (
                  row.description ? (
                    <p className="mt-1 line-clamp-2 text-xs leading-snug text-muted-foreground">
                      {row.description}
                    </p>
                  ) : null
                ) : (
                  <p className="mt-1 flex items-start gap-1 text-xs leading-snug text-danger">
                    <TriangleAlert className="mt-px size-3 shrink-0" aria-hidden />
                    {row.access.message}
                  </p>
                )}
              </td>
              <td className="px-3 py-3 whitespace-nowrap text-muted-foreground">
                {row.language ?? "—"}
              </td>
              <td className="px-3 py-3 text-right tabular-nums">
                <span className="inline-flex items-center gap-1">
                  <Star className="size-3 text-muted-foreground" aria-hidden />
                  {formatCompact(row.stars)}
                </span>
              </td>
              <td className="px-3 py-3 text-right tabular-nums">
                <span className="inline-flex items-center gap-1">
                  <GitFork className="size-3 text-muted-foreground" aria-hidden />
                  {formatCompact(row.forks)}
                </span>
              </td>
              <td className="px-3 py-3 text-right tabular-nums">
                <Count value={row.openPullRequests} label="Pull requests" />
              </td>
              <td className="px-3 py-3 text-right tabular-nums">
                <Count value={row.openIssues} label="Issues" />
              </td>
              <td className="px-3 py-3 whitespace-nowrap text-muted-foreground">
                <RelativeTime iso={row.lastActivityAt} now={now} />
              </td>
              <td className="px-3 py-3">
                {row.access.ok ? (
                  <CiStatusBadge status={row.ciStatus} />
                ) : (
                  <StatusBadge tone="neutral" icon={Lock}>
                    No access
                  </StatusBadge>
                )}
              </td>
              <td className="px-3 py-3">
                <HealthBadge level={row.healthLevel} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
