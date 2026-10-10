# 0002 — One data-source seam and a `Resource` type for missing data

## Context

DevPulse must work in two clearly separated modes — demo (sample data, no credentials) and live (GitHub) — and must never present partial or missing GitHub data as if it were complete. GitHub's API is lopsided: lists are paginated, statistics endpoints answer 202 while computing, permissions vary per endpoint, and rate limits can cut a page load short.

## Decision

1. **A single interface**, `DashboardDataSource` (`getSnapshots`, `getSnapshot`), implemented by `DemoDataSource` and `GitHubDataSource`. Both return the same plain, JSON-serialisable domain objects (`src/lib/domain`). Pages and metrics cannot tell which they have, and demo code cannot reach the GitHub client.
2. **Every dataset is a `Resource<T>`**: `ok` (with `complete` and an optional `note`), `pending`, or `unavailable` (with a reason: forbidden, unauthorized, not_found, rate_limited, disabled, error). Reading `data` without checking `status` is a type error.
3. **Aggregates carry coverage**: summing across repositories reports how many contributed and whether any figure is a lower bound, instead of treating gaps as zeros.
4. **Metrics are pure functions** over these objects with an injected `now`.
5. **Demo data is generated, deterministic and obviously fictional**: seeded per repository, relative to `now`, `sample-org/…` names, no GitHub URLs, and tests assert chronology and identity rules.

## Consequences

- Good: UI states for partial/unavailable data are first-class and testable; metrics are trivially unit-testable; the demo exercises healthy, failing and quiet repositories.
- Good: a permission problem degrades one section, not the page.
- Cost: more code in the UI (every consumer handles four states) and a larger domain model than a pass-through of API responses would need.
- Cost: demo data must be maintained alongside the metrics (guarded by invariant tests).

## Alternatives considered

- **Pass-through API types in the UI:** simpler initially, but leaks GitHub's shapes and nulls everywhere and makes honest partial-data handling ad hoc.
- **Throwing on any failure and showing an error page:** one revoked scope would blank the whole dashboard.
- **Mixing sample values into live pages as placeholders:** rejected — it is exactly the "fabricated metrics" failure the project exists to avoid.
