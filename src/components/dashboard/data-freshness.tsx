import { Clock } from "lucide-react";
import type { DataMode } from "@/lib/domain/types";
import { formatRelative } from "@/lib/format";

export function DataFreshness({
  mode,
  fetchedAt,
  now,
}: {
  mode: DataMode;
  fetchedAt: string;
  now: Date;
}) {
  return (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Clock className="size-3.5" aria-hidden />
      {mode === "demo" ? "Sample data generated " : "Data fetched from GitHub "}
      <time dateTime={fetchedAt}>{formatRelative(fetchedAt, now)}</time>
    </p>
  );
}
