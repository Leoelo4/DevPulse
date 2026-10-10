"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatLongDate, formatShortDate } from "@/lib/format";
import type { WeeklyIssueFlow } from "@/lib/metrics/issues";
import { ChartCard } from "./chart-card";
import { createTooltip } from "./chart-tooltip";

const tooltip = createTooltip({ formatLabel: (label) => `Week of ${formatLongDate(label)}` });

export function IssueFlowChart({
  weeks,
  windowNote,
}: {
  weeks: WeeklyIssueFlow[];
  windowNote?: string;
}) {
  return (
    <ChartCard
      title="Issue flow"
      description={["Issues opened and closed per week", windowNote].filter(Boolean).join(" · ")}
      provenance="calculated"
      definition={
        <p>
          Counts issues (not pull requests) by the week they were opened and the week they were
          closed. When closures outpace openings the backlog is shrinking; the reverse means it is
          growing.
        </p>
      }
      legend={[
        { label: "Opened", color: "var(--series-2)" },
        { label: "Closed", color: "var(--series-3)" },
      ]}
      table={{
        columns: ["Week starting", "Opened", "Closed"],
        rows: weeks.map((w) => [formatLongDate(w.weekStart), w.opened, w.closed]),
      }}
      tableCaption="Issues opened and closed per week"
      height="h-56"
    >
      <ResponsiveContainer
        width="100%"
        height="100%"
        initialDimension={{ width: 480, height: 224 }}
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
            name="Opened"
            fill="var(--series-2)"
            radius={[4, 4, 0, 0]}
            maxBarSize={14}
            isAnimationActive={false}
          />
          <Bar
            dataKey="closed"
            name="Closed"
            fill="var(--series-3)"
            radius={[4, 4, 0, 0]}
            maxBarSize={14}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
