"use client";

import { BarChart3, Table2 } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { MetricInfo } from "@/components/common/metric-info";
import { Provenance, type ProvenanceKind } from "@/components/common/provenance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

export interface LegendItem {
  label: string;
  /** A CSS colour or `var(--token)` reference. */
  color: string;
  /** Mirrors the mark: a filled square for bars/areas, a short stroke for lines. */
  shape?: "square" | "line";
  /** Status series (pass/fail) get an icon glyph in front so colour is never the only cue. */
  glyph?: ReactNode;
}

export interface ChartTableData {
  columns: string[];
  rows: Array<Array<string | number>>;
}

/**
 * Frame shared by every chart: title, provenance, a definition popover, a legend for two or more
 * series, and a Chart/Table toggle so every plotted value is reachable without hover or colour.
 */
export function ChartCard({
  title,
  description,
  provenance,
  definition,
  legend,
  table,
  tableCaption,
  height = "h-64",
  className,
  children,
}: {
  title: string;
  description?: string;
  provenance: ProvenanceKind;
  definition: ReactNode;
  legend?: LegendItem[];
  table: ChartTableData;
  tableCaption?: string;
  height?: string;
  className?: string;
  children: ReactNode;
}) {
  const [view, setView] = useState<"chart" | "table">("chart");
  const tableId = useId();

  return (
    <Card className={cn("gap-3", className)}>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <CardTitle className="flex items-center gap-1.5 text-sm">
              {title}
              <MetricInfo label={title}>{definition}</MetricInfo>
            </CardTitle>
            {description ? (
              <p className="text-xs leading-snug text-muted-foreground">{description}</p>
            ) : null}
          </div>
          <ToggleGroup
            type="single"
            size="sm"
            variant="outline"
            value={view}
            onValueChange={(next) => next && setView(next as "chart" | "table")}
            aria-label={`${title} view`}
          >
            <ToggleGroupItem value="chart" aria-label="Show chart">
              <BarChart3 aria-hidden />
            </ToggleGroupItem>
            <ToggleGroupItem value="table" aria-label="Show data table">
              <Table2 aria-hidden />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 pt-1">
          {legend && legend.length >= 2 ? (
            <ul className="flex flex-wrap items-center gap-x-4 gap-y-1" aria-label="Legend">
              {legend.map((item) => (
                <li
                  key={item.label}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground"
                >
                  <span
                    aria-hidden
                    className={cn(
                      "inline-block shrink-0",
                      item.shape === "line" ? "h-0.5 w-3 rounded-full" : "size-2.5 rounded-[3px]",
                    )}
                    style={{ backgroundColor: item.color }}
                  />
                  {item.glyph}
                  {item.label}
                </li>
              ))}
            </ul>
          ) : (
            <span />
          )}
          <Provenance kind={provenance} />
        </div>
      </CardHeader>
      <CardContent>
        {view === "chart" ? (
          <div className={cn("w-full", height)}>{children}</div>
        ) : (
          <div
            id={tableId}
            className={cn(
              "w-full overflow-auto rounded-md border",
              height === "h-64" ? "max-h-64" : "max-h-80",
            )}
          >
            <table className="w-full text-left text-xs">
              {tableCaption ? <caption className="sr-only">{tableCaption}</caption> : null}
              <thead className="sticky top-0 bg-muted/60">
                <tr>
                  {table.columns.map((column) => (
                    <th
                      key={column}
                      scope="col"
                      className="px-3 py-2 font-medium whitespace-nowrap"
                    >
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {table.rows.map((row, i) => (
                  <tr key={i}>
                    {row.map((cell, j) => (
                      <td key={j} className="px-3 py-1.5 whitespace-nowrap tabular-nums">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
