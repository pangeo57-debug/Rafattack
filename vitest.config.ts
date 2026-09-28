import { defineConfig } from "vitest/config";
import path from "path";

const TEST_DB = "postgresql://postgres:localdev@localhost:5432/surplo_test";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    environment: "node",
    globalSetup: ["tests/global-setup.ts"],
    setupFiles: ["tests/setup.ts"],
    // All tests share one real Postgres database, so they must not run in parallel.
    fileParallelism: false,
    env: { DATABASE_URL: process.env.TEST_DATABASE_URL ?? TEST_DB, AUTH_SECRET: "test" },
  },
});
