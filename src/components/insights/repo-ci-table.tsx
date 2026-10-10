import Link from "next/link";
import { DataTable, TBody, Td, Th, THead } from "@/components/common/data-table";
import { CiStatusBadge } from "@/components/common/status-badge";
import type { RepositorySnapshot } from "@/lib/domain/types";
import { formatDurationSeconds, formatPercent } from "@/lib/format";
import { dataOf } from "@/lib/metrics/util";
import { summarizeWorkflowRuns } from "@/lib/metrics/workflows";

/** One row per repository: the CI signal on its default branch plus recent reliability. */
export function RepoCiTable({ snapshots, now }: { snapshots: RepositorySnapshot[]; now: Date }) {
  return (
    <DataTable caption="CI status by repository" minWidth="min-w-[44rem]">
      <THead>
        <Th>Repository</Th>
        <Th title="Latest result of each workflow on the default branch">Default-branch CI</Th>
        <Th align="right">Success rate</Th>
        <Th align="right">Failures · 7 days</Th>
        <Th align="right">Median duration</Th>
      </THead>
      <TBody>
        {snapshots.map((snapshot) => {
          const runs = dataOf(snapshot.workflowRuns);
          const summary = runs
            ? summarizeWorkflowRuns(runs, now, snapshot.repository.defaultBranch)
            : null;
          return (
            <tr key={snapshot.repository.fullName} className="hover:bg-muted/30">
              <Td className="font-medium">
                <Link
                  href={`/repositories/${snapshot.repository.fullName}?tab=ci`}
                  className="underline-offset-4 hover:text-primary hover:underline"
                >
                  {snapshot.repository.fullName}
                </Link>
              </Td>
              <Td>
                <CiStatusBadge status={summary ? summary.currentStatus : "unknown"} />
              </Td>
              <Td align="right">
                {summary?.successRate != null ? formatPercent(summary.successRate) : "—"}
              </Td>
              <Td align="right">{summary ? summary.failuresLast7Days : "—"}</Td>
              <Td align="right">
                {summary ? formatDurationSeconds(summary.medianDurationSeconds) : "—"}
              </Td>
            </tr>
          );
        })}
      </TBody>
    </DataTable>
  );
}
