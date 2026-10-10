/**
 * ETag revalidation at the HTTP layer.
 *
 * GitHub does not count `304 Not Modified` responses against the rate limit, so once a resource has
 * been fetched, re-checking it with `If-None-Match` is free. This wrapper does that transparently
 * for every GET the Octokit client makes (including paginated list pages), and replays the stored
 * body when GitHub answers 304.
 *
 * Isolation: one `EtagCache` is created per signed-in user, so cached bodies (which may be private
 * repository data) can never be returned to another user. A revoked or downgraded token gets a
 * 401/404 from GitHub rather than a 304, so stale private data is not replayed either.
 */

export interface EtagEntry {
  etag: string;
  body: string;
  status: number;
  /** Headers worth replaying (content type, pagination links). */
  headers: [string, string][];
}

export class EtagCache {
  private readonly entries = new Map<string, EtagEntry>();

  constructor(
    private readonly maxEntries = 400,
    private readonly maxBodyBytes = 1_000_000,
  ) {}

  get(key: string): EtagEntry | undefined {
    const entry = this.entries.get(key);
    if (entry) {
      // Refresh recency (Map preserves insertion order, so re-insert = most recently used).
      this.entries.delete(key);
      this.entries.set(key, entry);
    }
    return entry;
  }

  set(key: string, entry: EtagEntry): void {
    if (entry.body.length > this.maxBodyBytes) return;
    this.entries.delete(key);
    this.entries.set(key, entry);
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }

  clear(): void {
    this.entries.clear();
  }

  get size(): number {
    return this.entries.size;
  }
}

const REPLAYED_HEADERS = ["content-type", "link", "etag", "x-github-media-type"];
const FRESH_HEADERS_PREFIX = "x-ratelimit-";

type FetchLike = typeof globalThis.fetch;

function urlOf(input: Parameters<FetchLike>[0]): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function methodOf(input: Parameters<FetchLike>[0], init: Parameters<FetchLike>[1]): string {
  return (
    init?.method ?? (typeof input === "object" && "method" in input ? input.method : "GET")
  ).toUpperCase();
}

export function createConditionalFetch(base: FetchLike, cache: EtagCache): FetchLike {
  return async (input, init) => {
    if (methodOf(input, init) !== "GET") return base(input, init);

    const key = urlOf(input);
    const cached = cache.get(key);
    const headers = new Headers(init?.headers);
    if (cached) headers.set("if-none-match", cached.etag);

    const response = await base(input, { ...init, headers });

    if (response.status === 304 && cached) {
      const replay = new Headers(cached.headers);
      // Keep the *current* rate-limit headers so quota tracking stays accurate.
      for (const [name, value] of response.headers) {
        if (name.startsWith(FRESH_HEADERS_PREFIX)) replay.set(name, value);
      }
      replay.set("x-devpulse-cache", "revalidated");
      return new Response(cached.body, { status: cached.status, headers: replay });
    }

    const etag = response.headers.get("etag");
    if (response.status === 200 && etag) {
      const body = await response.text();
      const kept: [string, string][] = [];
      for (const name of REPLAYED_HEADERS) {
        const value = response.headers.get(name);
        if (value) kept.push([name, value]);
      }
      cache.set(key, { etag, body, status: 200, headers: kept });

      // The body stream was consumed above; rebuild a response without encoding headers that no
      // longer describe the (already decoded) text.
      const rebuilt = new Headers(response.headers);
      rebuilt.delete("content-encoding");
      rebuilt.delete("content-length");
      return new Response(body, {
        status: response.status,
        statusText: response.statusText,
        headers: rebuilt,
      });
    }

    return response;
  };
}

/** Aborts requests that take longer than `ms`, so a slow GitHub cannot hang a page render. */
export function withTimeout(base: FetchLike, ms: number): FetchLike {
  return (input, init) => {
    const timeout = AbortSignal.timeout(ms);
    const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
    return base(input, { ...init, signal });
  };
}
