import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DemoDataSource } from "@/lib/data/demo/source";
import type { DashboardDataSource } from "@/lib/data/source";
import type { DataMode } from "@/lib/domain/types";
import { MODE_COOKIE, MODE_COOKIE_DEMO } from "./constants";

/**
 * Who is looking at the dashboard, and therefore which data they may see.
 *
 * This is the single place that decides between demo and live data. Every page, server action
 * and route handler that touches data goes through `requireViewer()`; the proxy only performs an
 * optimistic redirect and is never the authorization boundary.
 */
export type Viewer = { kind: "demo"; mode: Extract<DataMode, "demo"> };

export async function getViewer(): Promise<Viewer | null> {
  const store = await cookies();
  if (store.get(MODE_COOKIE)?.value === MODE_COOKIE_DEMO) {
    return { kind: "demo", mode: "demo" };
  }
  return null;
}

/** Returns the current viewer, or redirects anonymous visitors to the landing page. */
export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect("/");
  return viewer;
}

/** The data source for a viewer. Demo viewers can never reach the GitHub client. */
export function dataSourceFor(viewer: Viewer, now: Date = new Date()): DashboardDataSource {
  switch (viewer.kind) {
    case "demo":
      return new DemoDataSource(now);
  }
}
