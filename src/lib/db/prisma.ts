import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { requireLiveConfig } from "@/lib/env";

const globalForPrisma = globalThis as unknown as { devpulsePrisma?: PrismaClient };

/**
 * The shared Prisma client, created on first use. It is never constructed in demo-only
 * deployments, so DevPulse runs without a database unless live mode is configured.
 * (Cached on `globalThis` so Next's dev-mode module reloads don't open a new pool every time.)
 */
export function getPrisma(): PrismaClient {
  if (!globalForPrisma.devpulsePrisma) {
    const { databaseUrl } = requireLiveConfig();
    globalForPrisma.devpulsePrisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: databaseUrl }),
    });
  }
  return globalForPrisma.devpulsePrisma;
}
