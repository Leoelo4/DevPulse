import "server-only";
import { EtagCache } from "@/lib/github/conditional-fetch";
import { MemoryCache } from "./memory-cache";

/**
 * Process-wide caches, kept on `globalThis` so Next's dev-mode module reloads don't discard them.
 * See `memory-cache.ts` for the (documented) single-instance scope.
 */
interface SharedCaches {
  data: MemoryCache;
  etags: Map<string, EtagCache>;
}

const MAX_USERS_WITH_ETAGS = 50;

const globalCaches = globalThis as unknown as { devpulseCaches?: SharedCaches };

function caches(): SharedCaches {
  globalCaches.devpulseCaches ??= { data: new MemoryCache(1000), etags: new Map() };
  return globalCaches.devpulseCaches;
}

/** Resource-level TTL cache (keys are namespaced by user id). */
export function getDataCache(): MemoryCache {
  return caches().data;
}

/** One ETag cache per user, so cached bodies can never cross accounts. */
export function getEtagCache(userId: string): EtagCache {
  const { etags } = caches();
  let cache = etags.get(userId);
  if (cache) {
    // Mark as recently used.
    etags.delete(userId);
  } else {
    cache = new EtagCache();
  }
  etags.set(userId, cache);
  while (etags.size > MAX_USERS_WITH_ETAGS) {
    const oldest = etags.keys().next().value;
    if (oldest === undefined) break;
    etags.delete(oldest);
  }
  return cache;
}

/** Manual refresh: drop a user's cached resources (ETags are kept, so revalidation stays free). */
export function invalidateUserData(userId: string): number {
  return caches().data.invalidate(`${userId}:`);
}
