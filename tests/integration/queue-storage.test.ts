import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  createPipelineQueue,
  createPipelineQueueEvents,
  createPipelineWorker,
  createStorageService,
  fakeFailureJobName,
  fakeSuccessJobName
} from "../../packages/infrastructure/src/index.js";
import { loadWorkspaceConfig } from "../../packages/config/src/index.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const composeArgs = [
  "compose",
  "-p",
  "open-video-studio-infrastructure",
  "-f",
  "docker-compose.infrastructure.yml"
];

let startedRedisForSuite = false;
let storagePath = "";

function runDockerCommand(args: string[]) {
  return execFileSync("docker", args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: "pipe",
    encoding: "utf-8"
  });
}

function isRedisRunning() {
  const output = runDockerCommand([...composeArgs, "ps", "--status", "running", "--services"]);

  return output
    .split("\n")
    .map((line) => line.trim())
    .includes("redis");
}

async function waitForRedis() {
  const timeoutAt = Date.now() + 60000;

  while (Date.now() < timeoutAt) {
    try {
      runDockerCommand([...composeArgs, "exec", "-T", "redis", "redis-cli", "ping"]);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  throw new Error("Timed out waiting for Redis to become ready");
}

beforeAll(async () => {
  if (!isRedisRunning()) {
    runDockerCommand([...composeArgs, "up", "-d", "redis"]);
    startedRedisForSuite = true;
  }

  await waitForRedis();
  storagePath = await mkdtemp(join(tmpdir(), "open-video-studio-storage-"));
});

afterAll(async () => {
  await rm(storagePath, { force: true, recursive: true });

  if (startedRedisForSuite) {
    runDockerCommand([...composeArgs, "down"]);
  }
});

describe("queue and storage infrastructure", () => {
  it("executes fake queue jobs and performs a local storage round-trip", async () => {
    const config = loadWorkspaceConfig({
      QUEUE_NAME: "video-pipeline",
      REDIS_URL: "redis://127.0.0.1:6379",
      STORAGE_BASE_PATH: storagePath,
      STORAGE_DRIVER: "local"
    });

    const { close: closeQueue, queue } = createPipelineQueue(config);
    const { close: closeEvents, queueEvents } = createPipelineQueueEvents(config);
    const { close: closeWorker, worker } = createPipelineWorker(config, {
      error: () => undefined,
      info: () => undefined
    });
    const storage = createStorageService(config);

    await worker.waitUntilReady();
    await queueEvents.waitUntilReady();

    const stored = await storage.putObject("audio", "samples/intro.txt", "hello queue", "text/plain");
    const loaded = await storage.getObject("audio", "samples/intro.txt");

    expect(stored.key).toBe("audio/samples/intro.txt");
    expect(loaded.body.toString("utf-8")).toBe("hello queue");

    const successJob = await queue.add(fakeSuccessJobName, {
      referenceId: "job-success",
      target: "audio"
    });
    const failureJob = await queue.add(fakeFailureJobName, {
      referenceId: "job-failure",
      target: "render"
    });

    await expect(successJob.waitUntilFinished(queueEvents)).resolves.toEqual({
      message: "Processed audio:job-success",
      status: "succeeded"
    });
    await expect(failureJob.waitUntilFinished(queueEvents)).rejects.toThrow(
      "Fake pipeline failure for job-failure"
    );

    await queue.obliterate({ force: true });
    await closeWorker();
    await closeEvents();
    await closeQueue();
  });
});
