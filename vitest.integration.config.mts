import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const fromRoot = (path: string) => fileURLToPath(new URL(path, import.meta.url));

/**
 * Integration tests (real PostgreSQL + real Better Auth). Kept out of `npm test` because they need a
 * database; see src/test-integration/live-mode.integration.test.ts for how to run them.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fromRoot("./src"),
      "server-only": fromRoot("./src/test/server-only-stub.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/test-integration/**/*.integration.test.ts"],
    // One database, shared state: run files and tests serially.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
