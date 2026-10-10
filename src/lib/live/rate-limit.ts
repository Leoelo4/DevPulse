import { z } from "zod";
import type { GitHubClient } from "@/lib/github/client";

export interface RateLimitStatus {
  limit: number;
  remaining: number;
  resetAt: Date;
}

const schema = z.object({
  resources: z.object({
    core: z.object({ limit: z.number(), remaining: z.number(), reset: z.number() }),
  }),
});

/**
 * The viewer's current core API quota. Calling GitHub's rate-limit endpoint does not itself count
 * against the quota. Returns `null` if it cannot be read — this is informational only.
 */
export async function readRateLimit(
  client: Pick<GitHubClient, "request">,
): Promise<RateLimitStatus | null> {
  try {
    const response = await client.request("GET /rate_limit");
    const parsed = schema.safeParse(response.data);
    if (!parsed.success) return null;
    const { limit, remaining, reset } = parsed.data.resources.core;
    return { limit, remaining, resetAt: new Date(reset * 1000) };
  } catch {
    return null;
  }
}
