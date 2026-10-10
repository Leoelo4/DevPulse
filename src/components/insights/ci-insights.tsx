import { Info, Workflow } from "lucide-react";
import { RunOutcomeChart } from "@/components/charts/run-outcome-chart";
import { EmptyState } from "@/components/common/empty-state";
import { Section } from "@/components/common/page-header";
import { CiStatusBadge, RunStatusBadge } from "@/components/common/status-badge";
import { StatTile } from "@/components/common/stat-tile";
import { DataTable, TBody, Td, Th, THead } from "@/components/common/data-table";
import { RelativeTime } from "@/components/common/relative-time";
import { WorkflowRunTable, type WorkflowRunRow } from "@/components/tables/workflow-run-table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatDurationSeconds, formatInteger, formatPercent } from "@/lib/format";
import { ts } from "@/lib/metrics/util";
import { dailyRunOutcomes, summarizeWorkflowRuns } from "@/lib/metrics/workflows";

const MAX_RUNS = 25;

/** Explains the limits of CI signals. Shown wherever workflow results appear. */
export function CiMeasurementNote() {
  return (
    <Alert>
      <Info aria-hidden />
      <AlertTitle>What CI status does and doesn&apos;t tell you</AlertTitle>
      <AlertDescription>
        <p>
          <strong className="font-medium">Measured:</strong> the outcome of recent GitHub Actions
          workflow runs — whether each finished successfully, failed or timed out — and how long
          they took.
        </p>
        <p>
          <strong className="font-medium">Not measured:</strong> test coverage, test quality,
          flaky-test rates, other CI systems, or whether the software works in production. A passing
          latest run does not mean a repository is healthy, and a failing one may be a single broken
          branch.
        </p>
      </AlertDescription>
    </Alert>
  );
}

export function CiInsights({
  rows,
  now,
  defaultBranch,
  windowNote,
}: {
  rows: WorkflowRunRow[];
  now: Date;
  /** Used to determine current status. Omit for cross-repository views. */
  defaultBranch?: string;
  windowNote?: string;
}) {
  const runs = rows.map((row) => row.run);

  if (runs.length === 0) {
    return (
      <div className="space-y-4">
        <CiMeasurementNote />
        <EmptyState
          icon={Workflow}
          title="No workflow runs found"
          description="This repository has no GitHub Actions runs in the loaded window, or Actions is not used."
        />
      </div>
    );
  }

  const summary = summarizeWorkflowRuns(runs, now, defaultBranch);
  const latest = [...rows]
    .sort((a, b) => ts(b.run.createdAt) - ts(a.run.createdAt))
    .slice(0, MAX_RUNS);

  return (
    <div className="space-y-6">
      <CiMeasurementNote />

      <section aria-label="CI metrics" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {defaultBranch ? (
          <StatTile
            label={`Current status · ${defaultBranch}`}
            value={<CiStatusBadge status={summary.currentStatus} />}
            caption="Latest result of each workflow"
            provenance="calculated"
            definition={
              <p>
                Failing if any workflow&apos;s most recent pass/fail run on {defaultBranch} failed;
                running if a newer run is in progress; otherwise passing. Cancelled and skipped runs
                are ignored.
              </p>
            }
          />
        ) : null}
        <StatTile
          label="Success rate"
          value={summary.successRate === null ? "—" : formatPercent(summary.successRate)}
          caption={`${summary.successes} of ${summary.decisiveRuns} decisive runs${windowNote ? ` · ${windowNote}` : ""}`}
          tone={
            summary.successRate === null
              ? "default"
              : summary.successRate < 0.7
                ? "danger"
                : summary.successRate < 0.9
                  ? "warning"
                  : "success"
          }
          provenance="calculated"
          definition={
            <>
              <p>
                Successful runs divided by runs that finished with a clear pass or fail, across all
                branches and workflows in the loaded window.
              </p>
              <p>Cancelled, skipped and in-progress runs are excluded.</p>
            </>
          }
        />
        <StatTile
          label="Failures · 7 / 30 days"
          value={`${summary.failuresLast7Days} / ${summary.failuresLast30Days}`}
          caption="Failed, timed out or failed to start"
          tone={summary.failuresLast7Days > 0 ? "danger" : "default"}
          provenance="calculated"
          definition={<p>Count of failed runs created in the last 7 and 30 days, on any branch.</p>}
        />
        <StatTile
          label="Median duration"
          value={formatDurationSeconds(summary.medianDurationSeconds)}
          caption="Approximate"
          provenance="calculated"
          definition={
            <p>
              Median of (last updated − started) for completed runs. GitHub does not report an
              authoritative duration on the run itself, so queue time and re-runs can skew it.
            </p>
          }
        />
      </section>

      <RunOutcomeChart days={dailyRunOutcomes(runs, now, 30)} windowNote="Last 30 days" />

      <Section title="By workflow" description="Latest result and failure rate for each workflow.">
        <DataTable caption="Workflow breakdown" minWidth="min-w-[40rem]">
          <THead>
            <Th>Workflow</Th>
            <Th>Latest run</Th>
            <Th align="right">Runs</Th>
            <Th align="right">Failure rate</Th>
            <Th align="right">Median duration</Th>
            <Th>Last run</Th>
          </THead>
          <TBody>
            {summary.perWorkflow.map((workflow) => (
              <tr key={workflow.name} className="hover:bg-muted/30">
                <Td className="font-medium">{workflow.name}</Td>
                <Td>
                  <RunStatusBadge
                    run={{
                      status:
                        workflow.latestConclusion === "in_progress" ? "in_progress" : "completed",
                      conclusion:
                        workflow.latestConclusion === "in_progress"
                          ? null
                          : workflow.latestConclusion,
                    }}
                  />
                </Td>
                <Td align="right">{formatInteger(workflow.runs)}</Td>
                <Td align="right">
                  {workflow.failureRate === null ? "—" : formatPercent(workflow.failureRate)}
                </Td>
                <Td align="right">{formatDurationSeconds(workflow.medianDurationSeconds)}</Td>
                <Td className="whitespace-nowrap text-muted-foreground">
                  <RelativeTime iso={workflow.lastRunAt} now={now} />
                </Td>
              </tr>
            ))}
          </TBody>
        </DataTable>
      </Section>

      <Section
        title="Recent workflow runs"
        description={`Newest first · showing ${latest.length} of ${runs.length} loaded runs. Each row links to the run and its logs on GitHub.`}
      >
        <WorkflowRunTable rows={latest} now={now} caption="Recent workflow runs" />
      </Section>
    </div>
  );
}
