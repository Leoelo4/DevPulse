# Contributing to DevPulse

Thank you for considering a contribution. DevPulse is a small project that values correctness and honesty about data over feature count, so well-tested fixes and clearly scoped improvements are more welcome than large unrequested rewrites.

By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md). Security issues go through [SECURITY.md](SECURITY.md), not public issues.

## Ways to help

- **Report a bug** with the [bug template](.github/ISSUE_TEMPLATE/bug_report.yml). A reproducible report in demo mode is the most useful kind.
- **Pick up a roadmap item.** [ROADMAP.md](ROADMAP.md) lists scoped, self-contained improvements across accessibility, performance, documentation, API reliability and features. Comment on (or open) the matching issue before starting so work isn't duplicated.
- **Improve documentation**, especially setup steps that did not work for you.
- **Review pull requests.** A second pair of eyes on a metric definition is valuable.

## Local setup

Requirements: **Node.js 22.12+** and npm. Docker is only needed for live-mode development.

```bash
git clone https://github.com/Leoelo4/DevPulse.git
cd DevPulse
npm install            # also generates the Prisma client
npm run dev            # http://localhost:3000 — choose "Explore the demo"
```

Demo mode needs no environment, database or credentials, and covers almost all UI and metric work.

### Working on live mode

You need a PostgreSQL database and a GitHub OAuth App (see [README → Live mode setup](README.md#live-mode-setup)). Use a **separate OAuth App for development** so a local secret never touches your real one.

```bash
docker compose up -d
cp .env.example .env     # fill in the values
npx prisma migrate deploy
npm run dev
```

If you change `prisma/schema.prisma`, create a migration with `npm run db:migrate -- --name <what-changed>` and commit the generated SQL.

### Windows / OneDrive

If the repository lives in a synced OneDrive folder you may see `EPERM` errors from `.next`. Pause syncing, or keep the project outside OneDrive.

## Checks that must pass

CI runs these on every pull request; run them locally first:

```bash
npm run lint
npm run format:check      # `npm run format` fixes it
npm run typecheck
npm test
npm run build
npm run test:e2e          # needs `npx playwright install chromium` once
```

Integration tests need a **throwaway** PostgreSQL and a dedicated variable — they refuse to run against `DATABASE_URL` on purpose:

```bash
docker compose up -d
INTEGRATION_DATABASE_URL=postgresql://devpulse:devpulse@localhost:5432/devpulse npx prisma migrate deploy   # (DATABASE_URL set to the same)
INTEGRATION_DATABASE_URL=postgresql://devpulse:devpulse@localhost:5432/devpulse npm run test:integration
```

Please fix failing checks rather than skipping or loosening them. If a rule is genuinely wrong, say so in the pull request.

## Making a change

1. **Open or find an issue** for anything beyond a small fix.
2. **Branch** from `main` (`fix/…`, `feat/…`, `docs/…`).
3. **Write tests with the change.** New behaviour needs tests; a bug fix needs a test that fails without it. Metric changes need unit tests with an injected `now`; UI behaviour belongs in a component test or a Playwright spec.
4. **Keep commits focused** with clear messages (what and why). Squash noise before review.
5. **Open a pull request** using the template, and describe how you verified it.
6. **Respond to review.** Meaningful changes get reviewed before merging.

## Reproducing and reporting a bug

A good report contains: what you expected, what happened, the exact steps, whether you were in demo or live mode, the page URL, your browser/OS and Node version, and any console or server output. For data problems, say which repository _type_ it was (public/private, size) — **never paste access tokens or secrets** — and include the "partial view" / "unavailable" notice text if one was shown.

Demo mode is deterministic for a given moment in time, so a bug that reproduces there is easiest to fix.

## Project conventions

- **TypeScript is strict.** No `any` without a comment explaining why; prefer narrowing over assertions.
- **Metrics are pure functions** in `src/lib/metrics` taking an injected `now`. No I/O, no `Date.now()` inside.
- **Missing data is a type.** Datasets are `Resource<T>`; never render an unavailable dataset as zero, and say when data is partial.
- **Label provenance.** Every metric is "From GitHub" or "Calculated", with a definition. Document new metrics in [`docs/metrics.md`](docs/metrics.md).
- **Server/client boundary.** Anything touching tokens, secrets or the database is `server-only`. Client components get plain data, never tokens.
- **Authorization on the server.** Every page, action and route calls `requireViewer()` (or `requireLiveViewer()`); client checks are cosmetic. Treat query strings, form fields, cookies and GitHub responses as untrusted input — validate with Zod.
- **Accessibility is a requirement**, not polish: keyboard operable, visible focus, status never conveyed by colour alone, labelled controls. The Playwright suite runs axe on every page in both themes.
- **Style.** Prettier and ESLint decide formatting. Components are small and in `src/components/<area>`; shadcn components in `src/components/ui` are generated but may be edited (note why).
- **Dependencies.** Prefer none. Adding one needs a reason in the pull request; run `npm audit --omit=dev`.

### Adding a metric

1. Add the pure calculation and unit tests in `src/lib/metrics`.
2. Surface it with `StatTile` (definition + provenance) or a chart in `ChartCard` (legend, tooltip, table view).
3. Document it in `docs/metrics.md`, including its data window and limitations.
4. Make sure partial/unavailable inputs produce `unknown` or an explanatory notice, not a fabricated value.

### Adding a demo scenario

Sample repositories are profiles in `src/lib/data/demo/profiles.ts`. Names and handles must be obviously fictional (`sample-org/…`, `sample-dev-NN`), and sample repositories must never link to GitHub. The demo test suite checks chronology, determinism and these rules.

## Releases

Releases are cut by maintainers from `main`, with notes in [CHANGELOG.md](CHANGELOG.md). Contributors do not need to touch version numbers; add a line under **Unreleased** in the changelog for user-visible changes.

## Questions

Open an issue with the question label or start a discussion if enabled. Be kind; we are all learning.
