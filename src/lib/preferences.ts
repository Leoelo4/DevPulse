import { z } from "zod";
import {
  DEFAULT_THRESHOLDS,
  THRESHOLD_LIMITS,
  type MetricThresholds,
} from "@/lib/metrics/thresholds";

export const PREFS_COOKIE = "devpulse-prefs";

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
 * Reads thresholds from a stored cookie value. Anything missing, malformed, or out of range falls
 * back to the default for that field, so a tampered cookie can never break rendering.
 */
export function parseStoredThresholds(raw: string | undefined): MetricThresholds {
  if (!raw) return { ...DEFAULT_THRESHOLDS };
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ...DEFAULT_THRESHOLDS };
  }
  const record = typeof json === "object" && json !== null ? (json as Record<string, unknown>) : {};

  const pick = (key: keyof MetricThresholds): number => {
    const parsed = dayField(key).safeParse(record[key]);
    return parsed.success ? parsed.data : DEFAULT_THRESHOLDS[key];
  };
  return {
    stalePullRequestDays: pick("stalePullRequestDays"),
    staleIssueDays: pick("staleIssueDays"),
    releaseOverdueDays: pick("releaseOverdueDays"),
  };
}

export function serializeThresholds(thresholds: MetricThresholds): string {
  return JSON.stringify(thresholds);
}
