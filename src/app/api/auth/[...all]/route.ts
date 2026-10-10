import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/lib/auth/auth";
import { getLiveModeStatus } from "@/lib/env";

/**
 * Better Auth's OAuth endpoints (`/api/auth/*`), including the GitHub callback. When live mode is
 * not configured there is nothing to serve, and nothing here touches the database or GitHub.
 */
const notConfigured = () =>
  Response.json({ error: "Live mode is not configured on this deployment." }, { status: 404 });

const handlers = () => toNextJsHandler(getAuth());

export async function GET(request: Request) {
  return getLiveModeStatus().enabled ? handlers().GET(request) : notConfigured();
}

export async function POST(request: Request) {
  return getLiveModeStatus().enabled ? handlers().POST(request) : notConfigured();
}
