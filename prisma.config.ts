import "dotenv/config";
import { defineConfig } from "prisma/config";

// `prisma generate` does not need a database, so DATABASE_URL may be unset (demo-only installs).
// Commands that do need one (`migrate`, `studio`) will report the missing URL themselves.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
