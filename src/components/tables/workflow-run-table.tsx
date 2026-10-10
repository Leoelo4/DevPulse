import { GitBranch } from "lucide-react";
import Link from "next/link";
import { DataTable, TBody, Td, Th, THead } from "@/components/common/data-table";
import { ExternalLink } from "@/components/common/external-link";
import { RelativeTime } from "@/components/common/relative-time";
import { RunStatusBadge } from "@/components/common/status-badge";
import type { WorkflowRun } from "@/lib/domain/types";
import { formatDurationSeconds } from "@/lib/format";

export interface WorkflowRunRow {
  run: WorkflowRun;
  repoFullName?: string;
}

export function WorkflowRunTable({
  rows,
  now,
  caption,
}: {
  rows: WorkflowRunRow[];
  now: Date;
  caption: string;
}) {
  const showRepo = rows.some((row) => row.repoFullName);

  return (
    <DataTable caption={caption} minWidth="min-w-[52rem]">
      <THead>
        <Th>Workflow run</Th>
        <Th>Status</Th>
        <Th>Branch</Th>
        <Th>Event</Th>
        <Th
          align="right"
          title="Approximate: time between when GitHub reports the run started and when it was last updated. Queue time and re-runs can distort it."
        >
          Duration (approx.)
        </Th>
        <Th>Started</Th>
        <Th>
          <span className="sr-only">Logs</span>
        </Th>
      </THead>
      <TBody>
        {rows.map(({ run, repoFullName }) => (
          <tr key={`${repoFullName ?? ""}-${run.id}`} className="hover:bg-muted/30">
            <Td>
              <p className="leading-snug font-medium">
                {run.name}{" "}
                <span className="font-normal text-muted-foreground">#{run.runNumber}</span>
              </p>
              {showRepo && repoFullName ? (
                <Link
                  href={`/repositories/${repoFullName}`}
                  className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  {repoFullName}
                </Link>
              ) : null}
            </Td>
            <Td>
              <RunStatusBadge run={run} />
            </Td>
            <Td className="text-muted-foreground">
              {run.branch ? (
                <span className="inline-flex items-center gap-1 font-mono text-xs">
                  <GitBranch className="size-3" aria-hidden />
                  {run.branch}
                </span>
              ) : (
                "—"
              )}
            </Td>
            <Td className="text-muted-foreground">{run.event.replaceAll("_", " ")}</Td>
            <Td align="right" className="whitespace-nowrap">
              {formatDurationSeconds(run.durationSeconds)}
            </Td>
            <Td className="whitespace-nowrap text-muted-foreground">
              <RelativeTime iso={run.startedAt ?? run.createdAt} now={now} />
            </Td>
            <Td className="text-xs whitespace-nowrap">
              <ExternalLink href={run.htmlUrl}>
                <span>View logs</span>
              </ExternalLink>
            </Td>
          </tr>
        ))}
      </TBody>
    </DataTable>
  );
}
