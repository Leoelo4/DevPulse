# DevPulse

An open-source dashboard that turns GitHub activity into signals you can act on: pull request flow, CI reliability, release cadence and maintenance risks, with every metric defined and labelled as either **from GitHub** or **calculated by DevPulse**.

> **Status: early development.** Demo mode is complete and runs with no setup. Live mode (real GitHub data, sign-in, repository selection) is under construction and is **not yet available** — this README only describes what exists today.

## Try it in 30 seconds

Demo mode uses generated, clearly labelled sample data. It needs no GitHub account, database or credentials.

```bash
git clone https://github.com/Leoelo4/DevPulse.git
cd DevPulse
npm install
npm run dev
```

Open <http://localhost:3000> and choose **Explore the demo**. Requires Node.js 22.12 or newer.

## What works today

- **Overview** — repositories, open pull requests and issues, recent workflow failures, recent releases, contribution activity, per-repository health and a recent-activity feed.
- **Repository explorer** — search, filter (language, health, CI status), sort and paginate, with state kept in the URL.
- **Repository detail** — overview, pull requests, issues, CI, releases (with tags and deployments) and contributors, plus maintenance indicators and recommendations.
- **Pull request insights** — open / merged / closed, draft vs ready, age, time to merge, review status, stale and waiting-for-review lists.
- **CI & releases** — workflow outcomes over time, per-workflow breakdown, run list with links to logs, release history.
- **Settings** — theme (dark by default, light and system), thresholds behind calculated metrics.
- **Honest data labelling** — partial, truncated or unavailable data is called out next to the number; sample data can never be mistaken for real data.

Not built yet: GitHub sign-in, repository selection, live data, caching, rate-limit handling. See the [roadmap](#roadmap).

## Scripts

| Command                | What it does                                           |
| ---------------------- | ------------------------------------------------------ |
| `npm run dev`          | Start the development server                           |
| `npm run build`        | Production build                                       |
| `npm start`            | Serve the production build                             |
| `npm run lint`         | ESLint                                                 |
| `npm run format:check` | Prettier check (`npm run format` to fix)               |
| `npm run typecheck`    | TypeScript, strict mode                                |
| `npm test`             | Unit tests (Vitest)                                    |
| `npm run test:e2e`     | End-to-end tests (Playwright, demo mode, builds first) |

First time running the e2e tests: `npx playwright install chromium`.

## Stack

Next.js 16 (App Router, Cache Components) · React 19 · TypeScript 5.9 (strict) · Tailwind CSS 4 · shadcn/ui · Recharts · Zod · Vitest · Playwright · ESLint · Prettier. Planned for live mode: Octokit, Better Auth, PostgreSQL with Prisma.

Some choices differ from "latest" on purpose: TypeScript stays on 5.9 because `typescript-eslint` does not yet support 6+/7; ESLint stays on 9.x for the same plugin-compatibility reason; Prisma stays on 7.10 because `prisma@latest` currently points at a release candidate.

## Architecture in one paragraph

Data sources (demo fixtures today, the GitHub API later) implement one interface and produce plain, JSON-serialisable domain objects. Every dataset is wrapped in a `Resource` type that can be `ok` (complete or partial), `pending` or `unavailable`, so the UI cannot show a missing dataset as zero. All metrics are pure functions in `src/lib/metrics` that take an injected `now`, so they are deterministic and unit-tested. Pages are server components that read the viewer, load a snapshot and render; client components are limited to interaction (filters, charts, theme).

## Roadmap

1. Live mode: GitHub sign-in with minimum permissions, repository selection, Octokit data source with pagination, rate-limit handling and an explicit-TTL cache with manual refresh.
2. Documentation: full setup, GitHub OAuth configuration, deployment, security notes.
3. More: Content-Security-Policy with nonces, export, saved views.

## License

[MIT](LICENSE)
