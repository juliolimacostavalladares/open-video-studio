import { spawn, spawnSync } from "node:child_process";

import { afterEach, describe, expect, it } from "vitest";

const runningProcesses: Array<ReturnType<typeof spawn>> = [];

function startProcess(args: string[], env: NodeJS.ProcessEnv) {
  const child = spawn("pnpm", args, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ...env
    },
    stdio: "pipe"
  });

  runningProcesses.push(child);

  return child;
}

async function waitForUrl(url: string) {
  const timeoutAt = Date.now() + 90000;

  while (Date.now() < timeoutAt) {
    try {
      const response = await fetch(url);

      if (response.ok) {
        return response;
      }
    } catch {
      // Keep polling while the dev server boots.
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(`Timed out waiting for ${url}`);
}

afterEach(() => {
  for (const child of runningProcesses.splice(0)) {
    child.kill("SIGTERM");
  }
});

describe("workspace boot smoke", () => {
  it("boots the api and web apps", async () => {
    const buildResult = spawnSync("pnpm", ["build"], {
      cwd: process.cwd(),
      env: process.env,
      stdio: "pipe",
      encoding: "utf-8"
    });

    expect(buildResult.status).toBe(0);

    startProcess(["--filter", "api", "start"], {
      API_PORT: "4010"
    });
    startProcess(["--filter", "web", "start"], {
      PORT: "3010"
    });

    const apiResponse = await waitForUrl("http://127.0.0.1:4010/health");
    const webResponse = await waitForUrl("http://127.0.0.1:3010/api/health");

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
