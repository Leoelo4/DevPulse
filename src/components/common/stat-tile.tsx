import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import type { Aggregate } from "@/lib/metrics/overview";
import { formatCompact } from "@/lib/format";
import { cn } from "@/lib/utils";
import { MetricInfo } from "./metric-info";
import { Provenance, type ProvenanceKind } from "./provenance";

export function StatTile({
  label,
  value,
  caption,
  definition,
  provenance,
  tone = "default",
  className,
}: {
  /** Sentence case, no trailing colon. */
  label: string;
  value: ReactNode;
  /** One short line of context under the value (a window, a coverage note, a comparison). */
  caption?: ReactNode;
  /** Plain-language definition shown in the info popover. */
  definition: ReactNode;
  provenance: ProvenanceKind;
  tone?: "default" | "danger" | "warning" | "success";
  className?: string;
}) {
  return (
    <Card size="sm" className={cn("gap-2.5", className)}>
      <div className="flex items-center gap-1 px-(--card-spacing) text-xs font-medium text-muted-foreground">
        {label}
        <MetricInfo label={label}>{definition}</MetricInfo>
      </div>
      <div
        className={cn(
          "px-(--card-spacing) text-3xl leading-none font-semibold tracking-tight",
          tone === "danger" && "text-danger",
          tone === "warning" && "text-warning",
          tone === "success" && "text-success",
        )}
      >
        {value}
      </div>
      <div className="mt-auto space-y-1.5 px-(--card-spacing)">
        {caption ? <p className="text-xs leading-snug text-muted-foreground">{caption}</p> : null}
        <Provenance kind={provenance} />
      </div>
    </Card>
  );
}

/** Renders an `Aggregate` honestly: a "≥" prefix when truncated and a coverage note when partial. */
export function AggregateValue({ aggregate }: { aggregate: Aggregate }) {
  const none = aggregate.coveredRepos === 0 && aggregate.totalRepos > 0;
  if (none) return <span aria-label="Unavailable">—</span>;
  return (
    <>
      {aggregate.exact ? null : <span aria-label="at least">≥</span>}
      {formatCompact(aggregate.value)}
    </>
  );
}

export function aggregateCaption(aggregate: Aggregate, noun = "repositories"): string | null {
  if (aggregate.totalRepos === 0) return null;
  if (aggregate.coveredRepos === 0) return `Unavailable for all ${aggregate.totalRepos} ${noun}`;
  const parts: string[] = [];
  if (aggregate.coveredRepos < aggregate.totalRepos) {
    parts.push(`Based on ${aggregate.coveredRepos} of ${aggregate.totalRepos} ${noun}`);
  }
  if (!aggregate.exact) parts.push("lower bound: some data was truncated");
  return parts.length > 0 ? parts.join(" · ") : null;
}
