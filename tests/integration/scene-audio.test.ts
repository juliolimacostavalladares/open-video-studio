const databaseName = `open_video_studio_scene_audio_${process.pid}`;
const databaseUrl = `postgresql://postgres:postgres@127.0.0.1:54329/${databaseName}?schema=public`;
process.env.DATABASE_URL = databaseUrl;

const composeArgs = [
  "compose",
  "-p",
  "open-video-studio-database",
  "-f",
  "docker-compose.database.yml",
];

import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import type { FastifyInstance } from "fastify";
import { loadWorkspaceConfig } from "../../packages/config/src/index.js";
import { createStorageService } from "../../packages/infrastructure/src/index.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let app: FastifyInstance;
let backendUrl = "";
let generationCalls = 0;
let server: ReturnType<typeof createServer>;
// let startedPostgresForSuite = false;
let storagePath = "";

function buildWavBuffer(durationSeconds: number) {
  const sampleRate = 24000;
  const channels = 1;
  const bitsPerSample = 16;
  const blockAlign = (channels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;
  const dataSize = Math.floor(durationSeconds * byteRate);
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  return buffer;
}

function runDockerCommand(args: string[]) {
  return execFileSync("docker", args, {
    cwd: process.cwd(),
    encoding: "utf-8",
    env: process.env,
    stdio: "pipe",
  });
}

function isPostgresRunning() {
  const output = runDockerCommand([
    ...composeArgs,
    "ps",
    "--status",
    "running",
    "--services",
  ]);

  return output
    .split("\n")
    .map((line) => line.trim())
    .includes("postgres");
}

async function waitForPostgres() {
  const timeoutAt = Date.now() + 60000;

  while (Date.now() < timeoutAt) {
    try {
      runDockerCommand([
        ...composeArgs,
        "exec",
        "-T",
        "postgres",
        "pg_isready",
        "-U",
        "postgres",
        "-d",
        "postgres",
      ]);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  throw new Error("Timed out waiting for PostgreSQL to become ready");
}

function runPsql(sql: string) {
  runDockerCommand([
    ...composeArgs,
    "exec",
    "-T",
    "postgres",
    "psql",
    "-U",
    "postgres",
    "-d",
    "postgres",
    "-c",
    sql,
  ]);
}

async function runPsqlWithRetry(sql: string, attempts = 10) {
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      runPsql(sql);
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  throw lastError;
}

beforeAll(async () => {
  storagePath = await mkdtemp(join(tmpdir(), "open-video-studio-scene-audio-"));

  server = createServer((request, response) => {
    if (request.method === "POST" && request.url === "/generate") {
      generationCalls += 1;
      response.writeHead(200, {
        "Content-Type": "audio/wav",
        "X-Audio-Duration": "2.0",
      });
      response.end(Buffer.from(`scene-audio-${generationCalls}`));
      return;
    }

    response.writeHead(404);
    response.end();
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        throw new Error("Failed to start mock TTS server");
      }

      backendUrl = `http://127.0.0.1:${address.port}`;
      resolve();
    });
  });

  if (!isPostgresRunning()) {
    runDockerCommand([...composeArgs, "up", "-d", "postgres"]);
    // startedPostgresForSuite = true;
  }

  await waitForPostgres();
  await runPsqlWithRetry(
    `DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE);`,
  );
  await runPsqlWithRetry(`CREATE DATABASE "${databaseName}";`);

  process.env.DATABASE_URL = databaseUrl;
  process.env.OMNIVOICE_BASE_URL = backendUrl;
  process.env.STORAGE_DRIVER = "local";
  process.env.STORAGE_BASE_PATH = storagePath;

  execFileSync(
    "pnpm",
    ["--filter", "@repo/database", "exec", "prisma", "migrate", "deploy"],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
      },
      stdio: "pipe",
    },
  );

  const { buildApiApp } = await import("../../apps/api/src/app.js");
  app = buildApiApp();
});

afterAll(async () => {
  const { prisma } = await import("../../packages/database/src/client.js");
  await app.close();
  await prisma.$disconnect();
  await runPsqlWithRetry(
    `DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE);`,
  );
  await rm(storagePath, { force: true, recursive: true });

  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

  // if (startedPostgresForSuite) {
  //   runDockerCommand([...composeArgs, "down"]);
  // }
});

describe("scene audio generation routes (integration)", () => {
  it("creates one generation job per changed scene and blocks render when audio is invalid", async () => {
    const { prisma } = await import("../../packages/database/src/client.js");
    const storage = createStorageService(
      loadWorkspaceConfig({
        ...process.env,
        OMNIVOICE_BASE_URL: backendUrl,
        STORAGE_BASE_PATH: storagePath,
        STORAGE_DRIVER: "local",
      }),
    );

    const project = await prisma.project.create({
      data: {
        rawScript: `[CENA 1 - Abertura]
Texto da abertura.

[CENA 2 - Encerramento]
Texto do encerramento.`,
        status: "draft",
        title: "Projeto com audio por cena",
      },
    });

    const voiceProfile = await prisma.voiceProfile.create({
      data: {
        name: "Narrador Cena",
        provider: "omnivoice-studio",
        sampleDurationSeconds: 3.4,
        sampleMimeType: "audio/wav",
        samplePath: "audio/voice-profiles/scene.wav",
        status: "active",
      },
    });

    await storage.putObject(
      "audio",
      "voice-profiles/scene.wav",
      buildWavBuffer(3.4),
      "audio/wav",
    );

    await prisma.project.update({
      where: { id: project.id },
      data: { voiceProfileId: voiceProfile.id },
    });

    const recomposeResponse = await app.inject({
      method: "POST",
      url: `/projects/${project.id}/scenes/recompose`,
    });

    expect(recomposeResponse.statusCode).toBe(200);

    const blockedRender = await app.inject({
      method: "POST",
      url: `/projects/${project.id}/renders`,
    });

    expect(blockedRender.statusCode).toBe(409);
    expect(blockedRender.json()).toMatchObject({
      error: "AUDIO_REQUIRED",
    });

    const firstGeneration = await app.inject({
      method: "POST",
      url: `/projects/${project.id}/scenes/audio/generate`,
    });

    expect(firstGeneration.statusCode).toBe(200);
    expect(firstGeneration.json()).toMatchObject({
      generatedCount: 2,
      skippedCount: 0,
    });
    expect(generationCalls).toBe(2);

    const scenesAfterFirstGeneration = await prisma.scene.findMany({
      where: { projectId: project.id },
      orderBy: { orderIndex: "asc" },
      select: {
        audioContentHash: true,
        audioPath: true,
        id: true,
        orderIndex: true,
        status: true,
      },
    });

    expect(scenesAfterFirstGeneration).toHaveLength(2);
    expect(
      scenesAfterFirstGeneration.every((scene) => scene.status === "ready"),
    ).toBe(true);
    expect(
      scenesAfterFirstGeneration.every((scene) =>
        scene.audioPath?.startsWith("audio/scenes/"),
      ),
    ).toBe(true);

    const sceneToEdit = scenesAfterFirstGeneration[1];

    await prisma.scene.update({
      where: { id: sceneToEdit?.id },
      data: {
        script: "Texto do encerramento revisado.",
      },
    });

    const secondGeneration = await app.inject({
      method: "POST",
      url: `/projects/${project.id}/scenes/audio/generate`,
    });

    expect(secondGeneration.statusCode).toBe(200);
    expect(secondGeneration.json()).toMatchObject({
      generatedCount: 1,
      skippedCount: 1,
    });
    expect(generationCalls).toBe(3);

    const renderResponse = await app.inject({
      method: "POST",
      url: `/projects/${project.id}/renders`,
    });

    expect(renderResponse.statusCode).toBe(201);
    expect(renderResponse.json()).toMatchObject({
      projectId: project.id,
      status: "queued",
    });
  });
});
