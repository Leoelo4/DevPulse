import "server-only";
import { z } from "zod";

/**
 * Server environment, validated with Zod.
 *
 * Demo mode needs no configuration at all. Live mode needs the full set of variables below; if
 * only some are present the app reports exactly which are missing instead of failing obscurely.
 * Nothing in this module is imported by client code.
 */

const optionalString = z
  .string()
  .trim()
  .transform((value) => (value === "" ? undefined : value))
  .optional();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: optionalString.pipe(z.url().optional()),
  BETTER_AUTH_SECRET: optionalString.pipe(
    z
      .string()
      .min(32, "must be at least 32 characters (generate one with `openssl rand -base64 32`)")
      .optional(),
  ),
  BETTER_AUTH_URL: optionalString.pipe(z.url().optional()),
  GITHUB_CLIENT_ID: optionalString,
  GITHUB_CLIENT_SECRET: optionalString,
});

export type ServerEnv = z.infer<typeof envSchema>;

export interface LiveConfig {
  databaseUrl: string;
  authSecret: string;
  appUrl: string;
  githubClientId: string;
  githubClientSecret: string;
}

export type LiveModeStatus =
  { enabled: true; config: LiveConfig } | { enabled: false; missing: string[]; invalid: string[] };

const LIVE_VARIABLES = [
  "DATABASE_URL",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "GITHUB_CLIENT_ID",
  "GITHUB_CLIENT_SECRET",
] as const;

/** Pure: evaluates whether live mode can run from the given variables. */
export function evaluateLiveMode(source: Record<string, string | undefined>): LiveModeStatus {
  const parsed = envSchema.safeParse(source);

  const invalid: string[] = [];
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "environment");
      invalid.push(`${key}: ${issue.message}`);
    }
  }

  const present = (key: (typeof LIVE_VARIABLES)[number]) => {
    const value = source[key]?.trim();
    return value !== undefined && value !== "";
  };
  const missing = LIVE_VARIABLES.filter((key) => !present(key));

  if (!parsed.success || missing.length > 0) {
    return { enabled: false, missing: [...missing], invalid };
  }

  const env = parsed.data;
  return {
    enabled: true,
    config: {
      databaseUrl: env.DATABASE_URL as string,
      authSecret: env.BETTER_AUTH_SECRET as string,
      appUrl: env.BETTER_AUTH_URL as string,
      githubClientId: env.GITHUB_CLIENT_ID as string,
      githubClientSecret: env.GITHUB_CLIENT_SECRET as string,
    },
  };
}

/** Whether live mode is fully configured in this process's environment. */
export function getLiveModeStatus(): LiveModeStatus {
  return evaluateLiveMode(process.env);
}

/** Throws a descriptive error when live mode is required but not configured. */
export function requireLiveConfig(): LiveConfig {
  const status = getLiveModeStatus();
  if (status.enabled) return status.config;
  const problems = [
    status.missing.length > 0 ? `missing: ${status.missing.join(", ")}` : null,
    status.invalid.length > 0 ? `invalid: ${status.invalid.join("; ")}` : null,
  ].filter(Boolean);
  throw new Error(`Live mode is not configured (${problems.join(" | ")}). See .env.example.`);
}
