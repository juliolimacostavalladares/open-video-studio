import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    fileParallelism: false,
    hookTimeout: 120000,
    include: ["tests/integration/**/*.test.ts"],
    testTimeout: 120000
  }
});
