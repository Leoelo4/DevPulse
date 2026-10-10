# 0003 — Authentication, permissions and authorization

## Context

Live mode needs GitHub sign-in. The brief requires minimum permissions, server-only tokens, server-side authorization, and honesty about what cannot be verified. GitHub OAuth Apps have coarse scopes: there is no read-only private-repository scope (`repo` also permits writes), while a token with **no scopes** can read public data. GitHub Apps offer fine-grained permissions but a different installation model.

## Decision

1. **Better Auth** handles the OAuth flow, sessions and token storage with the Prisma adapter and `encryptOAuthTokens` (XChaCha20-Poly1305, keyed by `BETTER_AUTH_SECRET`).
2. **Sign-in requests no scopes** (`disableDefaultScope`). That grants public data only and needs no `user:email`; users get GitHub's `users.noreply.github.com` address when they have no public email.
3. **Private access is a separate explicit opt-in** that re-authorizes with the `repo` scope, behind an explanation that it is broad. A GitHub App mode is on the roadmap, not claimed.
4. **Authorization is server-side and fails closed.** `getViewer()` resolves demo vs live; any error validating a session means "anonymous". Every page, action and route calls `requireViewer()`/`requireLiveViewer()`. The proxy only does an optimistic redirect on cookie _presence_; a forged cookie gets nothing because the value is validated on the server.
5. **Selections are authorized against GitHub**: before persisting, each repository must be readable with the user's own token; GitHub answers 404 for private repositories the user cannot see, so a forged form field cannot add someone else's repository. Nothing is saved if any check fails or cannot be completed.
6. **Tokens never leave the server.** Modules handling them are `server-only`; client components receive booleans/plain data. Disconnect revokes the token at GitHub (best effort, reported honestly) and deletes the user, cascading to sessions, accounts and selections.
7. **The database layer is verified for real**: integration tests run the real Better Auth against a real PostgreSQL (cookie signing, forged-cookie rejection, token encryption at rest and decryption, cross-user isolation, cascade deletes).

## Consequences

- Good: the default footprint is as small as OAuth Apps allow; users opt in to more power knowingly.
- Good: authorization logic is concentrated and tested, not scattered across components.
- Cost: the OAuth code exchange with github.com is not covered by automated tests (it needs a real OAuth App); it is called out in the README and the roadmap proposes a manual smoke-test checklist.
- Cost: the `repo` scope is unavoidably broad until GitHub App support exists.
- Cost: sessions and tokens depend on `BETTER_AUTH_SECRET`; rotating it signs everyone out and invalidates stored tokens.

## Alternatives considered

- **Request `repo` up front:** simplest, but over-privileged for the common public-repository use case.
- **Personal access tokens pasted by users:** explicitly rejected — secrets would transit forms and be stored by the app.
- **GitHub App first:** better permissions, but a larger design (installations, per-repo grants) than this first version warranted.
- **Stateless JWT sessions:** no revocation; database sessions allow server-side sign-out and cascade deletion.
