# 0001 — Stack and dependency choices

## Context

DevPulse needs a modern full-stack TypeScript app with server rendering, charts, a database for a small amount of persistent data, and GitHub integration. The brief calls for stable, compatible versions and few dependencies. At the time of writing several "latest" tags are newer or less settled than they look, so versions were chosen by checking npm dist-tags and peer ranges and then verifying by installing, type-checking, linting, testing and building.

## Decision

| Choice                       | Version                                     | Why                                                                                                                                                     |
| ---------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Next.js (App Router) + React | 16.4 / 19.3                                 | Current stable; Cache Components and the proxy convention are the forward path (ADR 0005).                                                              |
| TypeScript                   | **5.9**, not 7                              | `typescript-eslint` supports `<6.1`; TypeScript 7 (the native port) breaks linting. Revisit when typescript-eslint supports it.                         |
| ESLint                       | **9.39**, not 10                            | Stays on the line `eslint-config-next` and its bundled plugins target.                                                                                  |
| Prisma + adapter             | **7.10**, not 8                             | `prisma@latest` currently points at an 8.0 _release candidate_; 7.10 is the last stable release. Uses the driver-adapter client (`@prisma/adapter-pg`). |
| Authentication               | **Better Auth 1.7**                         | See ADR 0003. Auth.js v5 never left beta (`next-auth@latest` is still v4).                                                                              |
| GitHub client                | `octokit` 5                                 | Bundles pagination, throttling and retry; ESM.                                                                                                          |
| Validation                   | Zod 4                                       | One library for environment, forms, query strings and API responses.                                                                                    |
| Charts                       | Recharts 3                                  | Composable, accessible-enough with our table-view and legend additions, no D3 wiring.                                                                   |
| UI                           | shadcn/ui (Radix) + Tailwind 4              | Components live in the repo and can be edited; Radix handles focus and ARIA.                                                                            |
| Tests                        | Vitest 5, Testing Library, Playwright + axe | Fast unit/component tests; real-browser e2e and automated accessibility checks.                                                                         |

Two `overrides` in `package.json` (`mysql2`, `deepmerge-ts`) pin patched versions of transitive dependencies of Prisma's CLI and Better Auth so that `npm audit --omit=dev` is clean. The remaining audit findings are in dev-only lint tooling (`braces` via `eslint-config-next`) with no upstream fix.

## Consequences

- Several dependencies trail the newest release; each lag has a concrete, documented reason, and Dependabot is configured to propose updates.
- `postinstall` runs `prisma generate`, so a fresh `npm install` produces a typed client without a database.
- Next 16's default `cacheComponents` mode imposes rendering rules the code must respect (ADR 0005).

## Alternatives considered

- **Auth.js (next-auth v5 beta):** rejected as pre-release; v4 does not fit the App Router well.
- **A hand-written OAuth flow:** fewer dependencies, but security-sensitive code that is better delegated to a maintained library whose behaviour we can integration-test.
- **Drizzle or raw SQL instead of Prisma:** reasonable, but Prisma's schema/migration workflow and generated types are familiar to most contributors.
- **Latest everything:** rejected for the reasons in the table.
