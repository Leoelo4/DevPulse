"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { WeeklyCommits } from "@/lib/domain/types";
import { formatLongDate, formatShortDate } from "@/lib/format";
import { ChartCard } from "./chart-card";
import { createTooltip } from "./chart-tooltip";

const tooltip = createTooltip({ formatLabel: (label) => `Week of ${formatLongDate(label)}` });

export function ContributionChart({
  weeks,
  title = "Commit activity",
  description,
  coverageNote,
}: {
  weeks: WeeklyCommits[];
  title?: string;
  description?: string;
  /** Shown in the description when only some repositories reported data. */
  coverageNote?: string;
}) {
  return (
    <ChartCard
      title={title}
      description={[description ?? "Commits per week to the default branch", coverageNote]
        .filter(Boolean)
        .join(" · ")}
      provenance="github"
      definition={
        <>
          <p>
            Weekly commit totals as reported by GitHub&apos;s statistics API for each
            repository&apos;s default branch, summed across the repositories shown. Weeks start on
            Sunday (UTC).
          </p>
          <p>
            The most recent week is still in progress. GitHub computes these statistics lazily and
            can omit repositories with very large histories.
          </p>
        </>
      }
      table={{
        columns: ["Week starting", "Commits"],
        rows: weeks.map((week) => [formatLongDate(week.weekStart), week.commits]),
      }}
      tableCaption={`${title}: commits per week`}
    >
      <ResponsiveContainer
        width="100%"
        height="100%"
        initialDimension={{ width: 640, height: 256 }}
      >
        <AreaChart data={weeks} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid vertical={false} strokeDasharray="0" />
          <XAxis
            dataKey="weekStart"
            tickFormatter={formatShortDate}
            tickLine={false}
            minTickGap={32}
            axisLine={{ strokeWidth: 1 }}
          />
          <YAxis tickLine={false} axisLine={false} width={44} allowDecimals={false} />
          <Tooltip
            content={tooltip}
            cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1 }}
          />
          <Area
            type="monotone"
            dataKey="commits"
            name="Commits"
            stroke="var(--series-1)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="var(--series-1)"
            fillOpacity={0.1}
            activeDot={{ r: 4, fill: "var(--series-1)", stroke: "var(--card)", strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
