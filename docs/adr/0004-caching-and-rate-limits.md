# 0004 — Layered caching and rate-limit behaviour

## Context

A cold dashboard load costs roughly 15–20 GitHub requests per repository. The authenticated REST limit is 5,000 requests per hour, shared across everything a user does. Pages are rendered per request, often repeatedly, and several GitHub endpoints are slow or compute lazily. The brief asks for pagination handling, avoiding redundant requests, explicit freshness rules, a manual refresh, and respect for rate limits.

## Decision

Four layers, from cheapest to most expensive:

1. **Single flight.** Concurrent loads of the same resource share one promise, so a burst of renders costs one request.
2. **TTL cache with explicit freshness rules** (`src/lib/cache/freshness.ts`, listed in `docs/metrics.md`): CI runs 2 min, pull requests/issues 5, releases 15, statistics 60, scaled by a user-selectable mode (fresh ×0.25, standard, conservative ×4). Keys are namespaced by user id. Failures and pending statistics are cached for only a minute.
3. **ETag revalidation** at the HTTP layer. Once a TTL expires the request is conditional; GitHub does not count `304 Not Modified` against the rate limit. One ETag cache per user, so private bodies never cross accounts, and a revoked token gets 401/404 rather than a replayed 304.
4. **Bounded reads.** Every list has a page cap and review histories have a per-repository budget, and anything cut short is reported (`complete: false` plus a note) rather than hidden. At most 12 repositories can be tracked.

**Rate limits.** Octokit's throttling retries once, and only if the required wait is ≤ 5 seconds; otherwise the error surfaces as `rate_limited` with the reset time. Review fetching stops as soon as quota runs out (affected pull requests show "not fetched"). Requests have a 15-second timeout and transient 5xx responses get two retries.

**Manual refresh** clears a user's cached resources (not the ETags), so the refresh itself is cheap. Settings shows the live quota.

## Consequences

- Good: typical repeat views make zero requests; refreshes after a TTL are mostly free; a rate-limited page still renders what it can.
- Good: the policy is visible and tunable (Settings and `freshness.ts`), and covered by tests with an injected clock and a fake GitHub.
- Cost: caches are per server process. On serverless platforms each cold instance refetches; a shared store (e.g. Redis) behind the same interface is on the roadmap.
- Cost: data can be up to one TTL stale — which is why every figure carries its fetch time and the freshness mode is user-selectable.

## Alternatives considered

- **Next.js `use cache`:** cache keys and tags are stored in plain text, so a token must not be a function argument; per-user tokens fit poorly. A purpose-built cache keyed by user id keeps tokens out of keys.
- **No caching, rely on ETags only:** conditional requests are free but still add latency per request; TTLs keep page loads fast.
- **Persisting repository data in the database:** more moving parts, stale-data and privacy implications, and the brief asks for persistence only where necessary.
- **Waiting out rate limits:** blocks a page render for up to an hour; reporting the reset time is more useful.
