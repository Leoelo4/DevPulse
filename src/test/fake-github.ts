/**
 * A fake GitHub for tests: a `fetch` that answers by `METHOD /path`, records every call, and can
 * return a sequence of responses for the same route (pagination, 202-then-200, 5xx-then-200).
 * It lets tests drive the real Octokit client (throttling, retry, pagination) without a network.
 */

export interface FakeResponse {
  status?: number;
  body?: unknown;
  headers?: Record<string, string>;
}

export interface FakeRequest {
  url: URL;
  method: string;
  headers: Headers;
}

export type FakeHandler = FakeResponse | ((request: FakeRequest) => FakeResponse);

export interface RecordedCall {
  method: string;
  path: string;
  query: Record<string, string>;
  headers: Headers;
}

export function createFakeGitHub(routes: Record<string, FakeHandler | FakeHandler[]>) {
  const calls: RecordedCall[] = [];
  const counters = new Map<string, number>();

  const fetchImpl: typeof globalThis.fetch = async (input, init) => {
    const url = new URL(
      typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url,
    );
    const method = (init?.method ?? "GET").toUpperCase();
    const headers = new Headers(init?.headers);
    calls.push({
      method,
      path: url.pathname,
      query: Object.fromEntries(url.searchParams),
      headers,
    });

    const key = `${method} ${url.pathname}`;
    const route = routes[key];
    let handler: FakeHandler | undefined;
    if (Array.isArray(route)) {
      const index = counters.get(key) ?? 0;
      counters.set(key, index + 1);
      handler = route[Math.min(index, route.length - 1)];
    } else {
      handler = route;
    }

    const response: FakeResponse =
      handler === undefined
        ? { status: 404, body: { message: "Not Found" } }
        : typeof handler === "function"
          ? handler({ url, method, headers })
          : handler;

    const status = response.status ?? 200;
    const responseHeaders = new Headers({
      "content-type": "application/json; charset=utf-8",
      "x-ratelimit-limit": "5000",
      "x-ratelimit-remaining": "4990",
      "x-ratelimit-reset": String(Math.floor(Date.now() / 1000) + 3600),
      ...response.headers,
    });
    const noBody = status === 204 || status === 202 || status === 304;
    const result = new Response(noBody ? null : JSON.stringify(response.body ?? {}), {
      status,
      headers: responseHeaders,
    });
    // Real fetch responses know their URL; Octokit's pagination plugin relies on it.
    Object.defineProperty(result, "url", { value: url.toString() });
    return result;
  };

  return {
    fetch: fetchImpl,
    calls,
    /** Number of calls to `METHOD /path` (query ignored). */
    count: (method: string, path: string) =>
      calls.filter((call) => call.method === method && call.path === path).length,
    reset: () => {
      calls.length = 0;
      counters.clear();
    },
  };
}

export type FakeGitHub = ReturnType<typeof createFakeGitHub>;

/** A `Link` header advertising a next page. */
export const nextLink = (path: string, page: number) =>
  `<https://api.github.com${path}?page=${page}>; rel="next"`;
