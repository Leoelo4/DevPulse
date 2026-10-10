import { z } from "zod";
import { isRefreshMode, type RefreshMode } from "@/lib/cache/freshness";
import {
  DEFAULT_THRESHOLDS,
  THRESHOLD_LIMITS,
  type MetricThresholds,
} from "@/lib/metrics/thresholds";

export const PREFS_COOKIE = "devpulse-prefs";

/** Everything a visitor can tune. Stored as one cookie so saving one setting never drops another. */
export interface Preferences {
  thresholds: MetricThresholds;
  /** How long live GitHub data is served from memory before re-checking (live mode only). */
  refreshMode: RefreshMode;
}

export const DEFAULT_PREFERENCES: Preferences = {
  thresholds: DEFAULT_THRESHOLDS,
  refreshMode: "standard",
};

const dayField = (key: keyof MetricThresholds) =>
  z.coerce
    .number()
    .int("Enter a whole number of days")
    .min(THRESHOLD_LIMITS[key].min, `Must be at least ${THRESHOLD_LIMITS[key].min}`)
    .max(THRESHOLD_LIMITS[key].max, `Must be at most ${THRESHOLD_LIMITS[key].max}`);

/** Strict schema used when a user submits the settings form: invalid input is rejected with messages. */
export const thresholdsInputSchema = z.object({
  stalePullRequestDays: dayField("stalePullRequestDays"),
  staleIssueDays: dayField("staleIssueDays"),
  releaseOverdueDays: dayField("releaseOverdueDays"),
});

/**
 * Reads preferences from a stored cookie value. Anything missing, malformed, or out of range falls
 * back to the default for that field, so a tampered cookie can never break rendering.
 */
export function parseStoredPreferences(raw: string | undefined): Preferences {
  const defaults = {
    thresholds: { ...DEFAULT_PREFERENCES.thresholds },
    refreshMode: DEFAULT_PREFERENCES.refreshMode,
  };
  if (!raw) return defaults;

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return defaults;
  }
  const record = typeof json === "object" && json !== null ? (json as Record<string, unknown>) : {};
  // Accept the current nested shape as well as the original flat thresholds-only cookie.
  const stored =
    typeof record.thresholds === "object" && record.thresholds !== null
      ? (record.thresholds as Record<string, unknown>)
      : record;

  const pick = (key: keyof MetricThresholds): number => {
    const parsed = dayField(key).safeParse(stored[key]);
    return parsed.success ? parsed.data : DEFAULT_THRESHOLDS[key];
  };

  return {
    thresholds: {
      stalePullRequestDays: pick("stalePullRequestDays"),
      staleIssueDays: pick("staleIssueDays"),
      releaseOverdueDays: pick("releaseOverdueDays"),
    },
    refreshMode: isRefreshMode(record.refreshMode)
      ? record.refreshMode
      : DEFAULT_PREFERENCES.refreshMode,
  };
}

export function serializePreferences(preferences: Preferences): string {
  return JSON.stringify(preferences);
}

/** Convenience for callers that only care about thresholds. */
export function parseStoredThresholds(raw: string | undefined): MetricThresholds {
  return parseStoredPreferences(raw).thresholds;
}
