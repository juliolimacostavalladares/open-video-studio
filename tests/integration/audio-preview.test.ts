import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { loadWorkspaceConfig } from "../../packages/config/src/index.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const composeArgs = [
  "compose",
  "-p",
  "open-video-studio-database",
  "-f",
  "docker-compose.database.yml",
];
const databaseName = `open_video_studio_audio_preview_${process.pid}`;
const databaseUrl = `postgresql://postgres:postgres@127.0.0.1:54329/${databaseName}?schema=public`;

let backendUrl = "";
let capturedBody = "";
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
    env: process.env,
    stdio: "pipe",
    encoding: "utf-8",
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
  throw new Error("Timed out waiting for PostgreSQL");
}

async function runPsqlWithRetry(sql: string, attempts = 10) {
  let lastError: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
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
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  throw lastError;
}

beforeAll(async () => {
  storagePath = await mkdtemp(
    join(tmpdir(), "open-video-studio-audio-preview-"),
  );

  server = createServer((request, response) => {
    if (request.method === "POST" && request.url === "/generate") {
      const chunks: Buffer[] = [];
      request.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      request.on("end", () => {
        capturedBody = Buffer.concat(chunks).toString("utf-8");
        response.writeHead(200, {
          "Content-Type": "audio/wav",
          "X-Audio-Duration": "2.2",
        });
        response.end(Buffer.from("preview-wav"));
      });
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
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: "pipe",
    },
  );
});

afterAll(async () => {
  const { prisma } = await import("../../packages/database/src/client.js");
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

describe("audio preview routes (integration)", () => {
  it("persists selected voice on the project and returns a preview for a scene", async () => {
    const { prisma } = await import("../../packages/database/src/client.js");
    const config = loadWorkspaceConfig({
      ...process.env,
      OMNIVOICE_BASE_URL: backendUrl,
      STORAGE_BASE_PATH: storagePath,
      STORAGE_DRIVER: "local",
    });
    const { createStorageService } = await import(
      "../../packages/infrastructure/src/index.js"
    );
    const storage = createStorageService(config);

    const project = await prisma.project.create({
      data: {
        title: "Projeto com preview",
        status: "draft",
      },
    });

    const voiceProfile = await prisma.voiceProfile.create({
      data: {
        name: "Narrador Preview",
        provider: "omnivoice-studio",
        sampleDurationSeconds: 3.4,
        sampleMimeType: "audio/wav",
        samplePath: "audio/voice-profiles/preview.wav",
        status: "active",
      },
    });

    await storage.putObject(
      "audio",
      "voice-profiles/preview.wav",
      buildWavBuffer(3.4),
      "audio/wav",
    );

    const scene = await prisma.scene.create({
      data: {
        orderIndex: 0,
        projectId: project.id,
        script: "Texto da cena para preview",
        status: "draft",
        title: "Cena 1",
      },
    });

    const { buildApiApp } = await import("../../apps/api/src/app.js");
    const app = buildApiApp();
    await app.ready();

    const selectResponse = await app.inject({
      method: "PATCH",
      url: `/projects/${project.id}/voice-profile`,
      payload: { voiceProfileId: voiceProfile.id },
    });

    expect(selectResponse.statusCode).toBe(200);
    expect(selectResponse.json()).toMatchObject({
      id: project.id,
      voiceProfileId: voiceProfile.id,
    });

    const previewResponse = await app.inject({
      method: "POST",
      url: `/projects/${project.id}/scenes/${scene.id}/preview`,
    });

    expect(previewResponse.statusCode).toBe(200);
    expect(previewResponse.headers["content-type"]).toContain("audio/wav");
    expect(previewResponse.body).toBe("preview-wav");
    expect(capturedBody).toContain("Texto da cena para preview");
    expect(capturedBody).toContain('name="ref_audio"');

    const storedProject = await prisma.project.findUnique({
      where: { id: project.id },
      select: { voiceProfileId: true },
    });

    expect(storedProject?.voiceProfileId).toBe(voiceProfile.id);

    await app.close();
  });
});
