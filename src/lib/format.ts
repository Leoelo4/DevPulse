const compactFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const integerFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const shortDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const longDateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

/** 1284 → "1,284"; use `formatCompact` for tiles. */
export function formatInteger(value: number): string {
  return integerFormatter.format(value);
}

/** 12_900 → "12.9K". Values under 1,000 are shown in full. */
export function formatCompact(value: number): string {
  return Math.abs(value) < 1000 ? integerFormatter.format(value) : compactFormatter.format(value);
}

export function formatPercent(ratio: number, fractionDigits = 0): string {
  return `${(ratio * 100).toFixed(fractionDigits)}%`;
}

/** ISO date/time → "Mar 4" (UTC). */
export function formatShortDate(iso: string): string {
  return shortDateFormatter.format(new Date(iso));
}

/** ISO date/time → "Mar 4, 2026" (UTC). */
export function formatLongDate(iso: string): string {
  return longDateFormatter.format(new Date(iso));
}

/** ISO date/time → "Mar 4, 2026, 14:05 UTC". */
export function formatDateTime(iso: string): string {
  return `${dateTimeFormatter.format(new Date(iso))} UTC`;
}

/** 135 → "2m 15s", 4_000 → "1h 6m". Returns an em dash for `null`. */
export function formatDurationSeconds(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return "—";
  const total = Math.max(0, Math.round(seconds));
  if (total < 60) return `${total}s`;
  const minutes = Math.floor(total / 60);
  if (total < 3600) return `${minutes}m ${total % 60}s`;
  const hours = Math.floor(total / 3600);
  return `${hours}h ${minutes % 60}m`;
}

/** 5.4 → "5.4h"; 52 → "2.2d". Used for response and merge times. Em dash for `null`. */
export function formatHours(hours: number | null): string {
  if (hours === null || !Number.isFinite(hours)) return "—";
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m`;
  if (hours < 48) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

export function formatDays(days: number | null): string {
  if (days === null || !Number.isFinite(days)) return "—";
  return days < 10 ? `${days.toFixed(1)}d` : `${Math.round(days)}d`;
}

/**
 * Relative time against an explicit `now` (so server and client agree, and tests are stable).
 * "3 hours ago", "yesterday", "2 weeks ago".
 */
export function formatRelative(iso: string, now: Date): string {
  const diffMs = now.getTime() - Date.parse(iso);
  if (!Number.isFinite(diffMs)) return "—";
  if (diffMs < 0) return "just now";
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (days < 60) return `${weeks} weeks ago`;
  const months = Math.floor(days / 30);
  if (days < 730) return `${months} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${formatInteger(count)} ${count === 1 ? singular : plural}`;
}
