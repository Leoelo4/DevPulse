import type { DataMode, RepositorySnapshot } from "@/lib/domain/types";

/**
 * The seam between "where data comes from" and "how it is shown". Demo fixtures and the GitHub
 * API client both implement this, so pages and metrics never know which one they are talking to.
 */
export interface DashboardDataSource {
  readonly mode: DataMode;
  /** Snapshots for every repository the viewer has selected (demo: all sample repositories). */
  getSnapshots(): Promise<RepositorySnapshot[]>;
  /** A single selected repository, or `null` when it is not selected / does not exist. */
  getSnapshot(owner: string, name: string): Promise<RepositorySnapshot | null>;
}
