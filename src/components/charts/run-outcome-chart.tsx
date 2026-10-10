"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatLongDate, formatShortDate } from "@/lib/format";
import type { DailyRunOutcome } from "@/lib/metrics/workflows";
import { ChartCard } from "./chart-card";
import { createTooltip } from "./chart-tooltip";

const tooltip = createTooltip({
  formatLabel: (label) => formatLongDate(label),
  total: "Decisive runs",
});

export function RunOutcomeChart({
  days,
  windowNote,
}: {
  days: DailyRunOutcome[];
  windowNote?: string;
}) {
  return (
    <ChartCard
      title="Workflow outcomes by day"
      description={["Successful and failed runs per day", windowNote].filter(Boolean).join(" · ")}
      provenance="calculated"
      definition={
        <>
          <p>
            Counts completed workflow runs per UTC day by the day they were created. Only runs that
            finished with a clear pass or fail are plotted; cancelled, skipped and in-progress runs
            are left out because they say nothing about reliability.
          </p>
          <p>
            A day with many failures can reflect one broken branch re-running, not many independent
            problems.
          </p>
        </>
      }
      legend={[
        {
          label: "Failed",
          color: "var(--status-critical)",
          glyph: <XCircle className="size-3 text-danger" aria-hidden />,
        },
        {
          label: "Succeeded",
          color: "var(--status-good)",
          glyph: <CheckCircle2 className="size-3 text-success" aria-hidden />,
        },
      ]}
      table={{
        columns: ["Date (UTC)", "Succeeded", "Failed"],
        rows: days.map((d) => [formatLongDate(d.date), d.success, d.failure]),
      }}
      tableCaption="Workflow run outcomes per day"
    >
      <ResponsiveContainer
        width="100%"
        height="100%"
        initialDimension={{ width: 640, height: 256 }}
      >
        <BarChart
          data={days}
          margin={{ top: 8, right: 8, bottom: 0, left: -12 }}
          barCategoryGap="20%"
        >
          <CartesianGrid vertical={false} />
          <XAxis dataKey="date" tickFormatter={formatShortDate} tickLine={false} minTickGap={24} />
          <YAxis tickLine={false} axisLine={false} width={44} allowDecimals={false} />
          <Tooltip content={tooltip} cursor={{ fill: "var(--muted)", opacity: 0.5 }} />
          {/* Surface-coloured strokes create the 2px gap between stacked segments. */}
          <Bar
            dataKey="failure"
            name="Failed"
            stackId="runs"
            fill="var(--status-critical)"
            stroke="var(--card)"
            strokeWidth={2}
            maxBarSize={20}
            isAnimationActive={false}
          />
          <Bar
            dataKey="success"
            name="Succeeded"
            stackId="runs"
            fill="var(--status-good)"
            stroke="var(--card)"
            strokeWidth={2}
            radius={[4, 4, 0, 0]}
            maxBarSize={20}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
