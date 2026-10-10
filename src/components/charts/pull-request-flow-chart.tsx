"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatLongDate, formatShortDate } from "@/lib/format";
import type { WeeklyPullRequestFlow } from "@/lib/metrics/pull-requests";
import { ChartCard } from "./chart-card";
import { createTooltip } from "./chart-tooltip";

const tooltip = createTooltip({ formatLabel: (label) => `Week of ${formatLongDate(label)}` });

const SERIES = {
  opened: { label: "Opened", color: "var(--series-1)" },
  merged: { label: "Merged", color: "var(--series-3)" },
  closedUnmerged: { label: "Closed without merging", color: "var(--series-2)" },
} as const;

export function PullRequestFlowChart({
  weeks,
  windowNote,
}: {
  weeks: WeeklyPullRequestFlow[];
  windowNote?: string;
}) {
  return (
    <ChartCard
      title="Pull request flow"
      description={["Opened, merged and closed per week", windowNote].filter(Boolean).join(" · ")}
      provenance="calculated"
      definition={
        <>
          <p>
            Counts pull requests by the week (Sunday start, UTC) in which they were opened, merged,
            or closed without merging. A single pull request can appear in more than one series
            across different weeks.
          </p>
          <p>
            Calculated by DevPulse from the pull requests GitHub returned. If that list was
            truncated, older weeks may be under-counted.
          </p>
        </>
      }
      legend={Object.values(SERIES).map(({ label, color }) => ({ label, color }))}
      table={{
        columns: ["Week starting", "Opened", "Merged", "Closed without merging"],
        rows: weeks.map((w) => [formatLongDate(w.weekStart), w.opened, w.merged, w.closedUnmerged]),
      }}
      tableCaption="Pull requests opened, merged and closed per week"
    >
      <ResponsiveContainer
        width="100%"
        height="100%"
        initialDimension={{ width: 640, height: 256 }}
      >
        <BarChart
          data={weeks}
          margin={{ top: 8, right: 8, bottom: 0, left: -12 }}
          barGap={2}
          barCategoryGap="22%"
        >
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="weekStart"
            tickFormatter={formatShortDate}
            tickLine={false}
            minTickGap={24}
          />
          <YAxis tickLine={false} axisLine={false} width={44} allowDecimals={false} />
          <Tooltip content={tooltip} cursor={{ fill: "var(--muted)", opacity: 0.5 }} />
          <Bar
            dataKey="opened"
            name={SERIES.opened.label}
            fill={SERIES.opened.color}
            radius={[4, 4, 0, 0]}
            maxBarSize={14}
            isAnimationActive={false}
          />
          <Bar
            dataKey="merged"
            name={SERIES.merged.label}
            fill={SERIES.merged.color}
            radius={[4, 4, 0, 0]}
            maxBarSize={14}
            isAnimationActive={false}
          />
          <Bar
            dataKey="closedUnmerged"
            name={SERIES.closedUnmerged.label}
            fill={SERIES.closedUnmerged.color}
            radius={[4, 4, 0, 0]}
            maxBarSize={14}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
