export type RevokeResult = { revoked: true } | { revoked: false; reason: string };

/**
 * Revokes the user's OAuth access token at GitHub (best effort). Used on "Disconnect" so the grant
 * does not outlive the local data. GitHub answers 204 on success and 404 if the token was already
 * invalid — both mean there is nothing left to revoke.
 *
 * This endpoint authenticates with the OAuth app's own client id and secret (HTTP Basic), not with
 * the user's token. The token is sent in the request body and is never logged.
 */
export async function revokeGitHubToken(
  options: { clientId: string; clientSecret: string; accessToken: string },
  fetchImpl: typeof globalThis.fetch = globalThis.fetch,
): Promise<RevokeResult> {
  try {
    const response = await fetchImpl(
      `https://api.github.com/applications/${encodeURIComponent(options.clientId)}/token`,
      {
        method: "DELETE",
        headers: {
          authorization: `Basic ${Buffer.from(`${options.clientId}:${options.clientSecret}`).toString("base64")}`,
          accept: "application/vnd.github+json",
          "content-type": "application/json",
          "x-github-api-version": "2022-11-28",
          "user-agent": "DevPulse",
        },
        body: JSON.stringify({ access_token: options.accessToken }),
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (response.status === 204 || response.status === 404) return { revoked: true };
    return { revoked: false, reason: `GitHub answered HTTP ${response.status}` };
  } catch {
    return { revoked: false, reason: "Could not reach GitHub" };
  }
}
