import "server-only";
import { getDataCache, getEtagCache } from "@/lib/cache/shared";
import type { RefreshMode } from "@/lib/cache/freshness";
import {
  PrismaSelectionStore,
  type SelectionPrisma,
  type SelectionStore,
} from "@/lib/db/selection-store";
import { getPrisma } from "@/lib/db/prisma";
import type { DashboardDataSource } from "@/lib/data/source";
import { createGitHubClient, type GitHubClient } from "@/lib/github/client";
import { GitHubDataSource } from "@/lib/github/source";
import { getGitHubCredentials } from "@/lib/auth/session";

/** The repositories a user has chosen to track. */
export function getSelectionStore(): SelectionStore {
  // The generated client satisfies this narrow interface; the cast avoids coupling the adapter to
  // Prisma's transaction-client generics.
  return new PrismaSelectionStore(getPrisma() as unknown as SelectionPrisma);
}

/** An authenticated GitHub client for the signed-in user (token stays server-side). */
export async function createViewerClient(
  userId: string,
): Promise<{ client: GitHubClient; scopes: string[] }> {
  const { accessToken, scopes } = await getGitHubCredentials();
  const client = createGitHubClient({ token: accessToken, etagCache: getEtagCache(userId) });
  return { client, scopes };
}

/** Live data source for the signed-in user, limited to their saved selection. */
export async function createLiveDataSource(
  userId: string,
  options: { now: Date; refreshMode: RefreshMode },
): Promise<DashboardDataSource> {
  const selection = await getSelectionStore().list(userId);
  if (selection.length === 0) {
    // Nothing selected yet: no need to fetch a token or touch GitHub at all.
    return { mode: "live", getSnapshots: async () => [], getSnapshot: async () => null };
  }

  const { client } = await createViewerClient(userId);
  return new GitHubDataSource({
    client,
    userId,
    selection,
    cache: getDataCache(),
    refreshMode: options.refreshMode,
    now: options.now,
  });
}
