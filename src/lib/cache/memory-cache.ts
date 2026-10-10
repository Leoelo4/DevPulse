/**
 * A small in-memory TTL cache with LRU eviction and single-flight loading.
 *
 * Scope and limits (documented in the README): it lives in one server process. On a multi-instance
 * or serverless deployment each instance has its own copy, so a cold instance simply refetches
 * (cheaply, thanks to ETag revalidation). Swap this class for a shared store (e.g. Redis) behind the
 * same interface if you need a global cache.
 *
 * Keys are namespaced by user id by callers, so one user's data is never served to another.
 */

interface Entry {
  value: unknown;
  storedAt: number;
  expiresAt: number;
}

export interface CacheResult<T> {
  value: T;
  /** Epoch ms when the value was loaded from its source. */
  fetchedAt: number;
  fromCache: boolean;
}

export class MemoryCache {
  private readonly entries = new Map<string, Entry>();
  private readonly inFlight = new Map<string, Promise<CacheResult<unknown>>>();

  constructor(
    private readonly maxEntries = 500,
    private readonly now: () => number = Date.now,
  ) {}

  /**
   * Returns a fresh cached value, or runs `loader` once (concurrent callers for the same key share
   * the same promise, so a burst of requests costs one GitHub call). `ttlMs` may depend on the
   * loaded value, so failures can be cached more briefly than successes.
   */
  async getOrLoad<T>(
    key: string,
    ttlMs: number | ((value: T) => number),
    loader: () => Promise<T>,
  ): Promise<CacheResult<T>> {
    const cached = this.entries.get(key);
    if (cached && cached.expiresAt > this.now()) {
      this.touch(key, cached);
      return { value: cached.value as T, fetchedAt: cached.storedAt, fromCache: true };
    }

    const pending = this.inFlight.get(key);
    if (pending) return pending as Promise<CacheResult<T>>;

    const load = (async (): Promise<CacheResult<T>> => {
      try {
        const value = await loader();
        const storedAt = this.now();
        const ttl = typeof ttlMs === "function" ? ttlMs(value) : ttlMs;
        this.set(key, { value, storedAt, expiresAt: storedAt + ttl });
        return { value, fetchedAt: storedAt, fromCache: false };
      } finally {
        this.inFlight.delete(key);
      }
    })();

    this.inFlight.set(key, load);
    return load;
  }

  /** Removes every entry whose key starts with `prefix`. Returns how many were removed. */
  invalidate(prefix: string): number {
    let removed = 0;
    for (const key of [...this.entries.keys()]) {
      if (key.startsWith(prefix)) {
        this.entries.delete(key);
        removed += 1;
      }
    }
    return removed;
  }

  clear(): void {
    this.entries.clear();
  }

  get size(): number {
    return this.entries.size;
  }

  private set(key: string, entry: Entry): void {
    this.entries.delete(key);
    this.entries.set(key, entry);
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }

  private touch(key: string, entry: Entry): void {
    this.entries.delete(key);
    this.entries.set(key, entry);
  }
}
