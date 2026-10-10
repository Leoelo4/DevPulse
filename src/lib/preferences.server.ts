import "server-only";
import { cookies } from "next/headers";
import type { MetricThresholds } from "@/lib/metrics/thresholds";
import { PREFS_COOKIE, parseStoredThresholds } from "./preferences";

/** Metric thresholds for the current visitor (cookie-backed; defaults when unset or invalid). */
export async function getThresholds(): Promise<MetricThresholds> {
  const store = await cookies();
  return parseStoredThresholds(store.get(PREFS_COOKIE)?.value);
}
