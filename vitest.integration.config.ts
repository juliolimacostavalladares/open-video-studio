import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const workspaceAliases = {
  "@repo/config": fileURLToPath(
    new URL("./packages/config/src/index.ts", import.meta.url),
  ),
  "@repo/database": fileURLToPath(
    new URL("./packages/database/src/index.ts", import.meta.url),
  ),
  "@repo/infrastructure": fileURLToPath(
    new URL("./packages/infrastructure/src/index.ts", import.meta.url),
  ),
  "@repo/video": fileURLToPath(
    new URL("./packages/video/src/index.ts", import.meta.url),
  ),
};

export default defineConfig({
  resolve: {
    alias: workspaceAliases,
  },
  test: {
    environment: "node",
    fileParallelism: false,
    hookTimeout: 120000,
    include: ["tests/integration/**/*.test.ts"],
    testTimeout: 120000,
  },
});
