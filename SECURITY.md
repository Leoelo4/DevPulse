# Security Policy

## Supported versions

DevPulse is pre-1.0 and has no published releases yet. Security fixes are made on the `main` branch.

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

Use GitHub's private vulnerability reporting: open the repository's **Security** tab and choose **Report a vulnerability**. If that option is unavailable, contact the maintainer [@Leoelo4](https://github.com/Leoelo4) through GitHub and ask for a private channel — please include no exploit details until one is agreed.

Helpful details: what you found, where (file, route or flow), steps to reproduce, the impact you believe it has, and whether it needs live mode and a particular GitHub configuration. Never include real access tokens or secrets in a report.

You can expect an acknowledgement as soon as the maintainers see the report, a good-faith assessment, and credit in the fix if you want it. This is a volunteer project, so timelines are best-effort.

## What DevPulse handles

Understanding the security model helps you target a report:

- **GitHub OAuth access tokens** are stored encrypted (XChaCha20-Poly1305, keyed by `BETTER_AUTH_SECRET`) in PostgreSQL and are only decrypted on the server to call the GitHub API. Server-only modules are marked `server-only`.
- **Sessions** are signed cookies backed by database rows; they are validated on every request.
- **Permissions requested:** none by default (public data only). Private repository access is an explicit opt-in requesting GitHub's `repo` scope. DevPulse never writes to GitHub.
- **Stored data:** user (name, avatar URL, and an email: the public email on the GitHub profile if one is set, otherwise GitHub's `users.noreply.github.com` address), sessions, encrypted tokens and the names of selected repositories. Repository data is not stored.
- **Disconnect** revokes the token at GitHub (best effort) and deletes the user, sessions, tokens and selections.

## In scope

- Authentication or authorization bypass (viewing another user's data, forging a session, escalating from demo to live data).
- Token or secret exposure (in responses, logs, the client bundle, or the database in plaintext).
- Injection (XSS, SQL, header, open redirect) and server-side request forgery.
- Insecure defaults that weaken the model above.

## Out of scope

- Findings that require a compromised host, database or `BETTER_AUTH_SECRET`.
- Missing security headers that are already documented as not yet implemented (a Content-Security-Policy is on the [roadmap](ROADMAP.md)).
- Denial of service through large volumes of requests to a self-hosted instance.
- Vulnerabilities in dependencies without a demonstrated impact on DevPulse (report them upstream; Dependabot tracks them here).
- GitHub OAuth's `repo` scope being broad — this is documented, opt-in, and a GitHub limitation.

## Deployer responsibilities

If you run DevPulse yourself: keep `BETTER_AUTH_SECRET` and `GITHUB_CLIENT_SECRET` secret and out of version control, use HTTPS (cookies are marked secure automatically when `BETTER_AUTH_URL` is `https`), use a dedicated database user, and keep dependencies updated.
