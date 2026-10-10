import { formatDateTime, formatRelative } from "@/lib/format";

/** Server-rendered relative time against an explicit `now`, with the exact UTC time on hover. */
export function RelativeTime({ iso, now }: { iso: string | null; now: Date }) {
  if (!iso) return <span className="text-muted-foreground">—</span>;
  return (
    <time dateTime={iso} title={formatDateTime(iso)}>
      {formatRelative(iso, now)}
    </time>
  );
}
