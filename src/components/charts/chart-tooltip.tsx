"use client";

import type { TooltipContentProps } from "recharts";

type Row = { key: string; name: string; color: string; value: number };

/**
 * Builds a Recharts tooltip renderer. Values lead (high-contrast, large) and series names follow,
 * each keyed by a short stroke of the series colour. Series names come from our own code, but they
 * are still rendered as React text nodes, never as HTML.
 */
export function createTooltip({
  formatLabel,
  formatValue = (value) => value.toLocaleString("en-US"),
  total,
}: {
  formatLabel: (label: string) => string;
  formatValue?: (value: number, seriesName: string) => string;
  /** Adds a "Total" row when set (for stacked series). */
  total?: string;
}) {
  return function ChartTooltip({ active, payload, label }: TooltipContentProps) {
    if (!active || !payload || payload.length === 0) return null;

    const rows: Row[] = payload
      .filter((entry) => typeof entry.value === "number")
      .map((entry) => ({
        key: String(entry.dataKey ?? entry.name),
        name: String(entry.name ?? entry.dataKey),
        color: String(entry.color ?? entry.stroke ?? entry.fill ?? "currentColor"),
        value: entry.value as number,
      }));
    if (rows.length === 0) return null;

    const sum = rows.reduce((acc, row) => acc + row.value, 0);

    return (
      <div className="min-w-36 rounded-lg border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-lg">
        <p className="mb-1.5 font-medium text-muted-foreground">
          {formatLabel(String(label ?? ""))}
        </p>
        <ul className="space-y-1">
          {rows.map((row) => (
            <li key={row.key} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span
                  aria-hidden
                  className="h-0.5 w-3 rounded-full"
                  style={{ backgroundColor: row.color }}
                />
                {row.name}
              </span>
              <span className="text-sm font-semibold text-foreground tabular-nums">
                {formatValue(row.value, row.name)}
              </span>
            </li>
          ))}
          {total && rows.length > 1 ? (
            <li className="flex items-center justify-between gap-4 border-t border-border pt-1">
              <span className="text-muted-foreground">{total}</span>
              <span className="text-sm font-semibold text-foreground tabular-nums">
                {formatValue(sum, total)}
              </span>
            </li>
          ) : null}
        </ul>
      </div>
    );
  };
}
