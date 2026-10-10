"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AgeBucket } from "@/lib/metrics/pull-requests";
import { ChartCard } from "./chart-card";
import { createTooltip } from "./chart-tooltip";

const tooltip = createTooltip({ formatLabel: (label) => `Open for ${label}` });

export function AgeBucketChart({ buckets }: { buckets: AgeBucket[] }) {
  return (
    <ChartCard
      title="Open pull request age"
      description="How long currently open pull requests have been waiting"
      provenance="calculated"
      definition={
        <>
          <p>
            Groups currently open pull requests by the time since they were created. It describes
            the backlog today, not how long pull requests historically took to merge.
          </p>
        </>
      }
      table={{
        columns: ["Age", "Open pull requests"],
        rows: buckets.map((bucket) => [bucket.label, bucket.count]),
      }}
      tableCaption="Open pull requests grouped by age"
      height="h-56"
    >
      <ResponsiveContainer
        width="100%"
        height="100%"
        initialDimension={{ width: 480, height: 224 }}
      >
        <BarChart
          data={buckets}
          margin={{ top: 20, right: 8, bottom: 0, left: -12 }}
          barCategoryGap="25%"
        >
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" tickLine={false} interval={0} />
          <YAxis tickLine={false} axisLine={false} width={44} allowDecimals={false} />
          <Tooltip content={tooltip} cursor={{ fill: "var(--muted)", opacity: 0.5 }} />
          <Bar
            dataKey="count"
            name="Open pull requests"
            fill="var(--series-1)"
            radius={[4, 4, 0, 0]}
            maxBarSize={24}
            isAnimationActive={false}
          >
            <LabelList
              dataKey="count"
              position="top"
              className="fill-foreground text-[11px] font-medium"
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
