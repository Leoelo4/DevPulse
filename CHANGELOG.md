# Changelog

All notable changes to DevPulse are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project intends to follow [Semantic Versioning](https://semver.org/) once it has a first release.

No version has been released yet; everything below is unreleased and subject to change.

## [Unreleased]

### Added

- **Demo mode**: a complete, clearly labelled sample-data experience that needs no GitHub account, database or credentials.
- **Dashboard pages**: Overview, Repository explorer (search, filter, sort, pagination, URL state), Repository detail (overview, pull requests, issues, CI, releases with tags and deployments, contributors), Pull request insights, CI & releases, and Settings.
- **Metrics**, all pure and unit-tested: pull request throughput, age, time to merge (median/p90), review state, stale and waiting-for-review lists; issue reply and close times; CI success rate, per-workflow status and duration; release cadence; contributor concentration and commit momentum; six health indicators with recommendations. Every metric has a definition and a "From GitHub" / "Calculated" label ([`docs/metrics.md`](docs/metrics.md)).
- **Honest data handling**: a `Resource` type for complete, partial, pending and unavailable datasets, with in-place explanations.
- **Live mode**: GitHub sign-in via Better Auth with no scopes by default and an explicit opt-in for private repositories; encrypted token storage; repository selection authorized against GitHub; disconnect that revokes the token and deletes stored data.
- **GitHub integration**: Octokit client with rate-limit handling, bounded retries and timeouts; Zod-validated responses; capped pagination; ETag revalidation; an explicit-TTL in-memory cache with refresh modes and manual refresh; rate-limit status in Settings.
- **Design system**: dark-first charcoal/slate theme with light and system modes, contrast-checked tokens, a colour-vision-validated chart palette, charts with legends, tooltips and table views.
- **Accessibility**: skip link, keyboard navigation, ARIA labelling, text/icon status indicators; automated axe checks on every page in both themes.
- **Tooling**: strict TypeScript, ESLint, Prettier, Vitest (unit and component), Playwright (end-to-end, accessibility, responsive), real-database integration tests, GitHub Actions CI, Dependabot.
- **Documentation**: README, contributing guide, code of conduct, security policy, roadmap, metric reference and architecture decision records.

### Known limitations

See [README → Known limitations](README.md#known-limitations). Notably, the OAuth code exchange with github.com is not covered by automated tests, and caches are per server process.
