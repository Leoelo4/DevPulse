import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { RefreshMode } from "@/lib/cache/freshness";
import { DemoDataSource } from "@/lib/data/demo/source";
import type { DashboardDataSource } from "@/lib/data/source";
import { getLiveModeStatus } from "@/lib/env";
import { MODE_COOKIE, MODE_COOKIE_DEMO } from "./constants";
import { getSessionUser, ReconnectRequiredError } from "./session";

/**
 * Who is looking at the dashboard, and therefore which data they may see.
 *
 * This is the single place that decides between demo and live data. Every page, server action
 * and route handler that touches data goes through `requireViewer()` / `requireLiveViewer()`; the
 * proxy only performs an optimistic redirect and is never the authorization boundary.
 */
export type Viewer =
  | { kind: "demo"; mode: "demo" }
  | { kind: "live"; mode: "live"; userId: string; name: string; image: string | null };

export type LiveViewer = Extract<Viewer, { kind: "live" }>;

export async function getViewer(): Promise<Viewer | null> {
  const store = await cookies();
  // Demo is an explicit choice, recorded in a cookie that grants nothing but sample data.
  if (store.get(MODE_COOKIE)?.value === MODE_COOKIE_DEMO) {
    return { kind: "demo", mode: "demo" };
  }

  // Live mode is only reachable when fully configured, and only with a valid server-side session.
  if (!getLiveModeStatus().enabled) return null;
  const user = await getSessionUser();
  if (!user) return null;
  return { kind: "live", mode: "live", userId: user.id, name: user.name, image: user.image };
}

/** Returns the current viewer, or redirects anonymous visitors to the landing page. */
export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect("/");
  return viewer;
}

/** For pages and actions that only make sense with a GitHub account (demo viewers go to the demo). */
export async function requireLiveViewer(): Promise<LiveViewer> {
  const viewer = await requireViewer();
  if (viewer.kind !== "live") redirect("/overview");
  return viewer;
}

/**
 * The data source for a viewer. Demo viewers can never reach the GitHub client. A live viewer whose
 * GitHub grant is unusable is sent back to sign in again instead of seeing an error page.
 */
export async function dataSourceFor(
  viewer: Viewer,
  options: { now: Date; refreshMode: RefreshMode },
): Promise<DashboardDataSource> {
  if (viewer.kind === "demo") return new DemoDataSource(options.now);

  try {
    // Imported lazily so demo-only deployments never load the auth/database modules.
    const { createLiveDataSource } = await import("@/lib/live/live-source");
    return await createLiveDataSource(viewer.userId, options);
  } catch (error) {
    if (error instanceof ReconnectRequiredError) redirect("/?reconnect=1");
    throw error;
  }
}
