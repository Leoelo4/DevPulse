import "server-only";
import { connection } from "next/server";
import { dataSourceFor, requireViewer, type Viewer } from "@/lib/auth/viewer";
import type { RepositorySnapshot } from "@/lib/domain/types";
import type { MetricThresholds } from "@/lib/metrics/thresholds";
import { getThresholds } from "@/lib/preferences.server";

export interface DashboardContext {
  viewer: Viewer;
  /** The single instant all relative times and windows in this render are measured against. */
  now: Date;
  thresholds: MetricThresholds;
  snapshots: RepositorySnapshot[];
}

/**
 * Loads everything a dashboard page needs in one authorised step. Pages never construct a data
 * source themselves, so the demo/live decision and the authorisation check cannot be skipped.
 */
export async function loadDashboard(): Promise<DashboardContext> {
  const viewer = await requireViewer();
  // `new Date()` is request-specific: opt out of (pre)rendering before reading the clock.
  await connection();
  const now = new Date();
  const [snapshots, thresholds] = await Promise.all([
    dataSourceFor(viewer, now).getSnapshots(),
    getThresholds(),
  ]);
  return { viewer, now, thresholds, snapshots };
}

export interface RepositoryContext extends Omit<DashboardContext, "snapshots"> {
  snapshot: RepositorySnapshot | null;
}

export async function loadRepository(owner: string, name: string): Promise<RepositoryContext> {
  const viewer = await requireViewer();
  await connection();
  const now = new Date();
  const [snapshot, thresholds] = await Promise.all([
    dataSourceFor(viewer, now).getSnapshot(owner, name),
    getThresholds(),
  ]);
  return { viewer, now, thresholds, snapshot };
}
