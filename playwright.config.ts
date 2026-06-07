import { defineConfig } from "@playwright/test";

import { testPorts } from "./tests/fixtures/workspace.js";

const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  workers: 1,
  use: {
    baseURL: `http://127.0.0.1:${testPorts.e2eWebPort}`,
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: `API_PORT=${testPorts.e2eApiPort} pnpm --filter api start`,
      port: testPorts.e2eApiPort,
      reuseExistingServer: !isCI,
      timeout: 120_000,
    },
    {
      command: `PORT=${testPorts.e2eWebPort} NEXT_PUBLIC_API_URL="http://127.0.0.1:${testPorts.e2eApiPort}" API_INTERNAL_URL="http://127.0.0.1:${testPorts.e2eApiPort}" pnpm --filter web start`,
      port: testPorts.e2eWebPort,
      reuseExistingServer: !isCI,
      timeout: 120_000,
    },
  ],
});
