import Link from "next/link";
import { DataTable, TBody, Td, Th, THead } from "@/components/common/data-table";
import { ExternalLink } from "@/components/common/external-link";
import { RelativeTime } from "@/components/common/relative-time";
import { PullRequestStateBadge, ReviewBadge } from "@/components/common/status-badge";
import { Badge } from "@/components/ui/badge";
import type { PullRequest } from "@/lib/domain/types";
import { formatDays } from "@/lib/format";
import { daysBetween } from "@/lib/metrics/util";

export interface PullRequestRow {
  pr: PullRequest;
  /** Set on cross-repository tables so each row can name and link its repository. */
  repoFullName?: string;
}

export function PullRequestTable({
  rows,
  now,
  staleDays,
  caption,
}: {
  rows: PullRequestRow[];
  now: Date;
  staleDays: number;
  caption: string;
}) {
  const showRepo = rows.some((row) => row.repoFullName);

  return (
    <DataTable caption={caption} minWidth="min-w-[52rem]">
      <THead>
        <Th>Pull request</Th>
        <Th>Status</Th>
        <Th title="Derived from the pull request's reviews. Only fetched for open, non-draft pull requests.">
          Review
        </Th>
        <Th>Author</Th>
        <Th align="right" title="Calculated: time since the pull request was opened">
          Age
        </Th>
        <Th>Last activity</Th>
      </THead>
      <TBody>
        {rows.map(({ pr, repoFullName }) => {
          const stale = pr.state === "open" && daysBetween(pr.updatedAt, now) >= staleDays;
          return (
            <tr key={`${repoFullName ?? ""}#${pr.number}`} className="hover:bg-muted/30">
              <Td className="max-w-md">
                <p className="leading-snug font-medium">
                  <ExternalLink href={pr.htmlUrl} showIcon={false}>
                    <span className="mr-1.5 text-muted-foreground">#{pr.number}</span>
                    {pr.title}
                  </ExternalLink>
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {showRepo && repoFullName ? (
                    <Link
                      href={`/repositories/${repoFullName}`}
                      className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                    >
                      {repoFullName}
                    </Link>
                  ) : null}
                  {pr.labels.map((label) => (
                    <Badge
                      key={label}
                      variant="outline"
                      className="h-4 rounded-md px-1.5 text-[10px]"
                    >
                      {label}
                    </Badge>
                  ))}
                  {stale ? (
                    <Badge
                      variant="outline"
                      className="h-4 rounded-md border-warning/30 bg-warning/10 px-1.5 text-[10px] text-warning"
                    >
                      Stale
                    </Badge>
                  ) : null}
                </div>
              </Td>
              <Td>
                <PullRequestStateBadge pr={pr} />
              </Td>
              <Td>
                {pr.state === "open" && !pr.draft ? (
                  <ReviewBadge state={pr.reviewState} />
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </Td>
              <Td className="text-muted-foreground">{pr.author ?? "—"}</Td>
              <Td align="right" className="whitespace-nowrap">
                {formatDays(daysBetween(pr.createdAt, pr.closedAt ? new Date(pr.closedAt) : now))}
              </Td>
              <Td className="whitespace-nowrap text-muted-foreground">
                <RelativeTime iso={pr.updatedAt} now={now} />
              </Td>
            </tr>
          );
        })}
      </TBody>
    </DataTable>
  );
}
