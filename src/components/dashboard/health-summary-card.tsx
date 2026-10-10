import Link from "next/link";
import { CiStatusBadge, HealthBadge } from "@/components/common/status-badge";
import { MetricInfo } from "@/components/common/metric-info";
import { Provenance } from "@/components/common/provenance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { HealthLevel } from "@/lib/metrics/health";
import type { RepositoryHealthRow } from "@/lib/metrics/overview";

const LEVEL_ORDER: Record<HealthLevel, number> = {
  at_risk: 0,
  needs_attention: 1,
  insufficient_data: 2,
  healthy: 3,
};

export function HealthSummaryCard({ rows }: { rows: RepositoryHealthRow[] }) {
  const sorted = [...rows].sort(
    (a, b) =>
      LEVEL_ORDER[a.summary.level] - LEVEL_ORDER[b.summary.level] ||
      a.repoFullName.localeCompare(b.repoFullName),
  );

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="flex items-center gap-1.5 text-sm">
            Repository health
            <MetricInfo label="Repository health">
              <p>
                A count-based roll-up of six maintenance indicators (commit activity, pull request
                backlog, issue responsiveness, CI reliability, release cadence and contributor
                spread).
              </p>
              <p>
                &ldquo;No concerns&rdquo; means none of the measured indicators raised a flag — not
                that the project is bug-free or well-run. Open a repository to see exactly what was
                measured.
              </p>
            </MetricInfo>
          </CardTitle>
          <Provenance kind="calculated" />
        </div>
        <p className="text-xs text-muted-foreground">Most at-risk first</p>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-border">
          {sorted.map((row) => (
            <li
              key={row.repoFullName}
              className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 py-2.5 first:pt-0 last:pb-0"
            >
              <Link
                href={`/repositories/${row.owner}/${row.name}`}
                className="min-w-0 truncate text-sm font-medium underline-offset-4 hover:text-primary hover:underline"
              >
                {row.name}
              </Link>
              <span className="flex items-center gap-1.5">
                <CiStatusBadge status={row.ciStatus} />
                <HealthBadge level={row.summary.level} />
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
