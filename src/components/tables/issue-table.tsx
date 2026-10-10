import { CircleDot, CircleSlash } from "lucide-react";
import { DataTable, TBody, Td, Th, THead } from "@/components/common/data-table";
import { ExternalLink } from "@/components/common/external-link";
import { RelativeTime } from "@/components/common/relative-time";
import { StatusBadge } from "@/components/common/status-badge";
import { Badge } from "@/components/ui/badge";
import type { Issue } from "@/lib/domain/types";
import { formatHours } from "@/lib/format";
import { daysBetween, MS_PER_HOUR, ts } from "@/lib/metrics/util";

function FirstResponse({ issue }: { issue: Issue }) {
  const response = issue.firstResponse;
  if (response.status === "responded") {
    return <>{formatHours((ts(response.at) - ts(issue.createdAt)) / MS_PER_HOUR)}</>;
  }
  if (response.status === "none") return <span className="text-warning">No reply yet</span>;
  return (
    <span
      className="text-muted-foreground"
      title="Comment history was not inspected for this issue"
    >
      Not measured
    </span>
  );
}

export function IssueTable({
  issues,
  now,
  staleDays,
  caption,
}: {
  issues: Issue[];
  now: Date;
  staleDays: number;
  caption: string;
}) {
  return (
    <DataTable caption={caption} minWidth="min-w-[46rem]">
      <THead>
        <Th>Issue</Th>
        <Th>Status</Th>
        <Th title="Calculated: time to the first comment from someone other than the author. Only measured for recent issues.">
          First reply
        </Th>
        <Th align="right">Comments</Th>
        <Th>Opened</Th>
        <Th>Last activity</Th>
      </THead>
      <TBody>
        {issues.map((issue) => {
          const stale = issue.state === "open" && daysBetween(issue.updatedAt, now) >= staleDays;
          return (
            <tr key={issue.number} className="hover:bg-muted/30">
              <Td className="max-w-md">
                <p className="leading-snug font-medium">
                  <ExternalLink href={issue.htmlUrl} showIcon={false}>
                    <span className="mr-1.5 text-muted-foreground">#{issue.number}</span>
                    {issue.title}
                  </ExternalLink>
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {issue.labels.map((label) => (
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
                {issue.state === "open" ? (
                  <StatusBadge tone="success" icon={CircleDot}>
                    Open
                  </StatusBadge>
                ) : (
                  <StatusBadge tone="merged" icon={CircleSlash}>
                    Closed
                  </StatusBadge>
                )}
              </Td>
              <Td className="whitespace-nowrap">
                <FirstResponse issue={issue} />
              </Td>
              <Td align="right">{issue.commentCount}</Td>
              <Td className="whitespace-nowrap text-muted-foreground">
                <RelativeTime iso={issue.createdAt} now={now} />
              </Td>
              <Td className="whitespace-nowrap text-muted-foreground">
                <RelativeTime iso={issue.updatedAt} now={now} />
              </Td>
            </tr>
          );
        })}
      </TBody>
    </DataTable>
  );
}
