const databaseName = `open_video_studio_render_job_${process.pid}`;
const databaseUrl = `postgresql://postgres:postgres@127.0.0.1:54329/${databaseName}?schema=public`;
process.env.DATABASE_URL = databaseUrl;

const composeArgs = [
  "compose",
  "-p",
  "open-video-studio-database",
  "-f",
  "docker-compose.database.yml",
];

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

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

describe("Render Job integration tests", () => {
  const tempDir = join(process.cwd(), ".tmp/render-job-integration-tests");

  beforeAll(async () => {
    mkdirSync(tempDir, { recursive: true });

    // Initialize test database
    if (!isPostgresRunning()) {
      runDockerCommand([...composeArgs, "up", "-d", "postgres"]);
    }

    await waitForPostgres();
    await runPsqlWithRetry(
      `DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE);`,
    );
    await runPsqlWithRetry(`CREATE DATABASE "${databaseName}";`);

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
  });

  afterAll(async () => {
    const { prisma } = await import("@repo/database");
    await prisma.$disconnect();

    await runPsqlWithRetry(
      `DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE);`,
    );

    rmSync(tempDir, { recursive: true, force: true });
  });

  it("should block render if scene audio is missing or invalid", async () => {
    const { buildApiApp } = await import("../../apps/api/src/app.js");
    const { prisma } = await import("@repo/database");
    const app = buildApiApp();

    // 1. Seed voice profile
    const voiceProfile = await prisma.voiceProfile.create({
      data: {
        name: "Narrador Teste",
        provider: "omnivoice-studio",
        sampleDurationSeconds: 1.0,
        sampleMimeType: "audio/wav",
        samplePath: "audio/voice-profiles/test.wav",
        status: "active",
      },
    });

    // 2. Create project
    const project = await prisma.project.create({
      data: {
        title: "Projeto Sem Audio",
        status: "draft",
        voiceProfileId: voiceProfile.id,
      },
    });

    // 3. Create scene without audio
    await prisma.scene.create({
      data: {
        projectId: project.id,
        orderIndex: 0,
        title: "Cena Sem Audio",
        script: "Script de teste.",
        status: "draft",
      },
    });

    // 4. Request render
    const response = await app.inject({
      method: "POST",
      url: `/projects/${project.id}/renders`,
    });

    expect(response.statusCode).toBe(409);
    const body = JSON.parse(response.body);
    expect(body.error).toBe("AUDIO_REQUIRED");
    expect(body.message).toContain("Existem cenas sem áudio válido");
  });

  it("should successfully queue and process a render job and enforce concurrency 1", async () => {
    const { buildApiApp } = await import("../../apps/api/src/app.js");
    const { prisma, buildSceneAudioHash } = await import("@repo/database");
    const { createPipelineWorker } = await import("@repo/infrastructure");

    const app = buildApiApp();

    // Start worker in integration test
    const { close: closeWorker } = createPipelineWorker();

    // 1. Seed voice profile
    const voiceProfile = await prisma.voiceProfile.create({
      data: {
        name: "Narrador Teste 2",
        provider: "omnivoice-studio",
        sampleDurationSeconds: 1.0,
        sampleMimeType: "audio/wav",
        samplePath: "audio/voice-profiles/test2.wav",
        status: "active",
      },
    });

    // 2. Create 2 projects for testing concurrency
    const projectA = await prisma.project.create({
      data: {
        title: "Projeto A",
        status: "draft",
        voiceProfileId: voiceProfile.id,
      },
    });

    const projectB = await prisma.project.create({
      data: {
        title: "Projeto B",
        status: "draft",
        voiceProfileId: voiceProfile.id,
      },
    });

    // Generate mock silent WAV data URL
    const silentWavHeader = Buffer.from([
      0x52, 0x49, 0x46, 0x46, 0x24, 0x1f, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45,
      0x66, 0x6d, 0x74, 0x20, 0x10, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00,
      0x40, 0x1f, 0x00, 0x00, 0x40, 0x1f, 0x00, 0x00, 0x01, 0x00, 0x08, 0x00,
      0x64, 0x61, 0x74, 0x61, 0x00, 0x1f, 0x00, 0x00,
    ]);
    const silentWavData = Buffer.alloc(8000, 128);
    const silentWav = Buffer.concat([silentWavHeader, silentWavData]);
    const audioDataUrl = `data:audio/wav;base64,${silentWav.toString("base64")}`;

    const sceneAudioHash = buildSceneAudioHash({
      script: "Texto de teste.",
      voiceProfileId: voiceProfile.id,
    });

    // 3. Create scenes with valid audio for both projects
    await prisma.scene.create({
      data: {
        projectId: projectA.id,
        orderIndex: 0,
        title: "Cena A",
        script: "Texto de teste.",
        status: "ready",
        audioPath: audioDataUrl,
        audioDurationSeconds: 1.0,
        audioContentHash: sceneAudioHash,
        voiceProfileId: voiceProfile.id,
      },
    });

    await prisma.scene.create({
      data: {
        projectId: projectB.id,
        orderIndex: 0,
        title: "Cena B",
        script: "Texto de teste.",
        status: "ready",
        audioPath: audioDataUrl,
        audioDurationSeconds: 1.0,
        audioContentHash: sceneAudioHash,
        voiceProfileId: voiceProfile.id,
      },
    });

    // 4. Request render for Project A and immediately for Project B
    const resA = await app.inject({
      method: "POST",
      url: `/projects/${projectA.id}/renders`,
    });

    const resB = await app.inject({
      method: "POST",
      url: `/projects/${projectB.id}/renders`,
    });

    expect(resA.statusCode).toBe(201);
    expect(resB.statusCode).toBe(201);

    const jobA = JSON.parse(resA.body);
    const jobB = JSON.parse(resB.body);

    expect(jobA.status).toBe("queued");
    expect(jobB.status).toBe("queued");

    // 5. Poll for completion of both jobs
    let completed = false;
    const timeout = Date.now() + 180000; // 3 minutes timeout

    while (Date.now() < timeout) {
      const dbJobA = await prisma.renderJob.findUnique({
        where: { id: jobA.id },
      });
      const dbJobB = await prisma.renderJob.findUnique({
        where: { id: jobB.id },
      });

      if (dbJobA?.status === "succeeded" && dbJobB?.status === "succeeded") {
        completed = true;
        break;
      }

      // Concurrency 1 verification:
      // When one job is running, the other must not be running (either queued or succeeded/failed)
      if (dbJobA?.status === "running") {
        expect(dbJobB?.status).not.toBe("running");
      }
      if (dbJobB?.status === "running") {
        expect(dbJobA?.status).not.toBe("running");
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    expect(completed).toBe(true);

    // Verify project statuses transitioned to ready_for_review
    const finalProjA = await prisma.project.findUnique({
      where: { id: projectA.id },
    });
    const finalProjB = await prisma.project.findUnique({
      where: { id: projectB.id },
    });

    expect(finalProjA?.status).toBe("ready_for_review");
    expect(finalProjB?.status).toBe("ready_for_review");

    // Cleanup worker
    await closeWorker();
  }, 600000);
});
