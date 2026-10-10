# 0005 — Cache Components, request-time rendering and the proxy

## Context

Next.js 16 enables Cache Components (and partial prefetching) by default for new apps, and states it will be the only model in the next major release. Under it, request data (cookies, headers, the clock) cannot be read during prerendering, so dynamic reads must sit behind `<Suspense>` boundaries or opt out of prerendering. Middleware is now called the _proxy_. DevPulse's pages are per-viewer and time-relative, so almost everything inside the app shell is dynamic.

## Decision

- **Stay on Cache Components** rather than opting out: it is the forward path, and it matches how the app is structured — a static shell (layout, navigation chrome, landing copy) with viewer-dependent content streaming in behind boundaries and a `loading.tsx` skeleton.
- **Viewer-dependent shell pieces get their own Suspense boundaries** (mode badge, demo banner), and client hooks that need request data (`usePathname` on dynamic routes) are wrapped with a working static fallback (the same navigation links without the active highlight).
- **The clock is read after request data and after `await connection()`.** `new Date()` is request-specific, and with partial prefetching Next can run pages in a runtime prerender where an unguarded clock is rejected. Loaders call `connection()` before taking `now`, and pass that single `now` through everything so all relative times in a render agree.
- **Environment is read at request time** (`await connection()` before reading `process.env` on the landing page), so one build behaves correctly once credentials are provided.
- **No use of `use cache` for user data.** Cache keys are stored in plain text, so tokens must not be arguments; user data is cached by our own user-namespaced cache (ADR 0004).
- **The proxy does two cheap things only**: return a clean 404 for malformed percent-encoded URLs (otherwise a decoding error surfaces as a 500) and redirect visitors with no sign-in cookie. It is explicitly not an authorization layer (ADR 0003).
- **Server Actions** re-validate the viewer themselves; the framework's origin checks provide CSRF protection for them.

## Consequences

- Good: fast, instantly navigable shell; no accidental stale per-user data; consistent time within a render.
- Cost: contributors must follow the rules above, and several were discovered only by running the production build and the e2e suite (the build alone did not catch the clock rule). The e2e tests protect them.
- Cost: Next keeps previously visited routes in the DOM, hidden, for instant back-navigation; tests therefore filter text locators to visible elements.

## Alternatives considered

- **`cacheComponents: false`** (the previous model): simpler today, but a migration later.
- **Rendering the whole app client-side with SWR:** more tokens and logic client-side, the opposite of the security goals.
