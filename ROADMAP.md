# Roadmap

This is a list of **intended work**, not promises or dates. Items are written to be small and self-contained so each can become one issue and one pull request. If you want one, comment on (or open) the issue first.

Status key: 🔧 needs design discussion · ✅ ready to pick up · 🌱 good first issue

## Reliability of the GitHub integration

- ✅ **Real OAuth smoke test.** Document (and ideally script) a manual checklist for the first real sign-in on a fresh OAuth App: sign in, private-access opt-in, selection, disconnect. The OAuth code exchange is the one part not covered by automated tests.
- 🔧 **Shared cache.** The TTL and ETag caches are per process. Define a small store interface and add an optional Redis implementation so serverless and multi-instance deployments don't start cold.
- ✅ **GraphQL for pull request reviews.** Review state currently costs one REST call per open pull request (budgeted to 25). A single GraphQL query could return `reviewDecision` for all of them.
- ✅ **Surface rate-limit pressure earlier.** Show remaining quota in the header when it drops below a threshold, not only in Settings.
- 🌱 **Retry affordance for "pending" statistics.** When GitHub is still computing commit statistics, offer a "check again" control on that section.
- 🔧 **GitHub App mode.** Fine-grained, read-only permissions and per-repository installation instead of OAuth's broad `repo` scope. Needs a design for how access level and repository selection map onto installations.
- 🔧 **GitHub Enterprise Server** support (configurable API base URL and an OAuth provider that targets the instance).

## Accessibility

- ✅ **Screen-reader pass on charts.** The table view exists; add an `aria-describedby` summary (range, peak, latest value) to each chart.
- ✅ **Reduced-data mode.** Respect `prefers-contrast: more` with stronger borders and non-colour chart encodings (the palette has a documented texture channel that is not yet implemented).
- 🌱 **Keyboard shortcuts** for navigation (`g o`, `g r`, …) with a discoverable help dialog.
- 🌱 **Focus management after filter changes** in the repository explorer (announce result count to assistive technology).

## Performance

- ✅ **Stream per-repository sections.** Repository detail loads one snapshot; split it so slow datasets (statistics) stream in behind their own Suspense boundaries.
- ✅ **Bundle analysis.** Measure and, if worthwhile, lazy-load Recharts on pages where charts are below the fold.
- 🌱 **Virtualised onboarding list** for users with hundreds of repositories.

## Documentation

- 🌱 **Deployment guides** verified on a real host (Vercel, Fly.io, a plain VPS), including a tested Dockerfile.
- 🌱 **Architecture diagram** in `docs/` as an image or Mermaid, beyond the README sketch.
- ✅ **Metric examples.** Add a worked example per metric in `docs/metrics.md` using the demo data.
- 🌱 **Translations of the README** and setup guide.

## Security

- 🔧 **Content-Security-Policy with nonces** via the proxy, compatible with the theme script and Recharts.
- ✅ **Rate limiting for server actions** (disconnect, selection) beyond the authentication endpoints' built-in limits.
- ✅ **Audit-log table** for sign-in, scope elevation and disconnect events (no tokens, ever).

## Product

- ✅ **Export** a repository's computed metrics as JSON/CSV.
- ✅ **Saved views** for the explorer (named filter/sort presets).
- 🔧 **Team / organization view** aggregating selected repositories by owner.
- 🔧 **Account-level preferences** stored server-side instead of in a cookie.
- ✅ **Trend sparklines** on stat tiles (the chart system already supports small multiples).
- 🌱 **Contributor avatars** (allow-listed to GitHub's avatar host, with a text fallback).

## Testing

- ✅ **Visual regression** for key pages in both themes.
- ✅ **Mutation testing** of `src/lib/metrics` to confirm the unit tests actually pin behaviour.
- 🌱 **Test the demo generator's profiles** against an explicit table of expected health levels.

## Release process

- 🔧 Decide on versioning, publish a first tagged release with notes, and keep [CHANGELOG.md](CHANGELOG.md) accurate. No release exists yet.
