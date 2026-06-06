import "../helpers/teardown.js";

import { describe, expect, it } from "vitest";

import { testPorts } from "../fixtures/workspace.js";
import { waitForUrl } from "../helpers/http.js";
import { runCommandSync, startProcess } from "../helpers/process.js";

describe("workspace boot smoke", () => {
  it("boots the api and web apps", async () => {
    const buildResult = runCommandSync("pnpm", ["build"]);

    expect(buildResult.status).toBe(0);

    startProcess("pnpm", ["--filter", "api", "start"], {
      env: {
        ...process.env,
        API_PORT: String(testPorts.integrationApiPort)
      }
    });
    startProcess("pnpm", ["--filter", "web", "start"], {
      env: {
        ...process.env,
        PORT: String(testPorts.integrationWebPort)
      }
    });

    const apiResponse = await waitForUrl(`http://127.0.0.1:${testPorts.integrationApiPort}/health`);
    const webResponse = await waitForUrl(
      `http://127.0.0.1:${testPorts.integrationWebPort}/api/health`
    );

    await expect(apiResponse.json()).resolves.toEqual({
      service: "api",
      status: "ok"
    });
    await expect(webResponse.json()).resolves.toEqual({
      service: "web",
      status: "ok"
    });
  });
});
