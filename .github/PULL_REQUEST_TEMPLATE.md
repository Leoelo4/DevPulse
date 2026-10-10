## What and why

<!-- What does this change, and what problem does it solve? Link the issue: "Closes #123". -->

## How I verified it

<!-- Commands you ran, pages you checked, screenshots for UI changes (demo mode is fine). -->

## Checklist

- [ ] `npm run lint`, `npm run format:check`, `npm run typecheck` and `npm test` pass locally
- [ ] New behaviour has tests (unit/component for logic, Playwright for flows); a bug fix has a test that fails without it
- [ ] Metrics are pure and take an injected `now`; new or changed metrics are documented in `docs/metrics.md`
- [ ] Missing, partial or unavailable data is shown honestly (no fabricated zeros), and provenance is labelled ("From GitHub" / "Calculated")
- [ ] No secrets, tokens or private data are committed or logged; token-handling code stays `server-only`
- [ ] Accessibility considered: keyboard operable, visible focus, status not conveyed by colour alone
- [ ] User-visible changes are noted under **Unreleased** in `CHANGELOG.md`
- [ ] Docs updated where behaviour or setup changed

## Notes for reviewers

<!-- Anything non-obvious: trade-offs, follow-ups, areas you would like extra scrutiny on. -->
