const databaseName = `open_video_studio_remotion_smoke_${process.pid}`;
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
import { existsSync, mkdirSync, rmSync } from "node:fs";
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

describe("remotion rendering smoke test", () => {
  const tempDir = join(process.cwd(), ".tmp/remotion-smoke-tests");

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

  it("successfully renders a video with only text (no assets)", async () => {
    const { renderVideo } = await import("@repo/infrastructure");
    const outputPath = join(tempDir, "output-text-only.mp4");
    const props = {
      scenes: [
        {
          id: "scene-1",
          orderIndex: 0,
          script: "Texto de teste sem assets.",
          audioDurationSeconds: 1.0,
        },
      ],
    };

    await renderVideo(props, outputPath);
    expect(existsSync(outputPath)).toBe(true);
  }, 180000);

  it("successfully renders a video with image asset but no audio", async () => {
    const { renderVideo } = await import("@repo/infrastructure");
    const outputPath = join(tempDir, "output-image-only.mp4");
    const base64Png =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
    const imageDataUrl = `data:image/png;base64,${base64Png}`;

    const props = {
      scenes: [
        {
          id: "scene-1",
          orderIndex: 0,
          script: "Texto com imagem.",
          audioDurationSeconds: 1.0,
          assetPath: imageDataUrl,
          assetKind: "image" as const,
        },
      ],
    };

    await renderVideo(props, outputPath);
    expect(existsSync(outputPath)).toBe(true);
  }, 180000);

  it("successfully renders a video with image and audio assets using inline data URLs", async () => {
    const { renderVideo } = await import("@repo/infrastructure");
    const outputPath = join(tempDir, "output-full.mp4");

    // Generate a 1-second silent WAV at 8000Hz, 8-bit mono
    const silentWavHeader = Buffer.from([
      0x52,
      0x49,
      0x46,
      0x46, // "RIFF"
      0x24,
      0x1f,
      0x00,
      0x00, // file size - 8
      0x57,
      0x41,
      0x56,
      0x45, // "WAVE"
      0x66,
      0x6d,
      0x74,
      0x20, // "fmt "
      0x10,
      0x00,
      0x00,
      0x00, // chunk size (16)
      0x01,
      0x00, // compression code (1 - PCM)
      0x01,
      0x00, // channels (1)
      0x40,
      0x1f,
      0x00,
      0x00, // sample rate (8000)
      0x40,
      0x1f,
      0x00,
      0x00, // byte rate (8000)
      0x01,
      0x00, // block align (1)
      0x08,
      0x00, // bits per sample (8)
      0x64,
      0x61,
      0x74,
      0x61, // "data"
      0x00,
      0x1f,
      0x00,
      0x00, // chunk size (8000 bytes)
    ]);
    const silentWavData = Buffer.alloc(8000, 128); // 8-bit PCM silence is 128
    const silentWav = Buffer.concat([silentWavHeader, silentWavData]);
    const audioDataUrl = `data:audio/wav;base64,${silentWav.toString("base64")}`;

    const base64Png =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
    const imageDataUrl = `data:image/png;base64,${base64Png}`;

    const props = {
      scenes: [
        {
          id: "scene-1",
          orderIndex: 0,
          script: "Texto com imagem e áudio.",
          audioPath: audioDataUrl,
          audioDurationSeconds: 1.0,
          assetPath: imageDataUrl,
          assetKind: "image" as const,
        },
      ],
    };

    await renderVideo(props, outputPath);
    expect(existsSync(outputPath)).toBe(true);
  }, 180000);

  it("successfully builds a render timeline from a database project and renders a multi-scene video", async () => {
    const { prisma, buildSceneAudioHash } = await import("@repo/database");
    const { renderVideo, buildVideoTimeline } = await import(
      "@repo/infrastructure"
    );
    const outputPath = join(tempDir, "output-database-timeline.mp4");

    // 1. Seed a voice profile
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

    // 2. Create a project
    const project = await prisma.project.create({
      data: {
        title: "Projeto Render Timeline",
        rawScript: `[CENA 1 - Abertura]
Primeira cena.

[CENA 2 - Fechamento]
Segunda cena.`,
        status: "draft",
        voiceProfileId: voiceProfile.id,
      },
    });

    // 3. Generate mock WAV and PNG data URLs
    const silentWavHeader = Buffer.from([
      0x52,
      0x49,
      0x46,
      0x46, // "RIFF"
      0x24,
      0x1f,
      0x00,
      0x00, // file size - 8
      0x57,
      0x41,
      0x56,
      0x45, // "WAVE"
      0x66,
      0x6d,
      0x74,
      0x20, // "fmt "
      0x10,
      0x00,
      0x00,
      0x00, // chunk size (16)
      0x01,
      0x00, // compression code (1 - PCM)
      0x01,
      0x00, // channels (1)
      0x40,
      0x1f,
      0x00,
      0x00, // sample rate (8000)
      0x40,
      0x1f,
      0x00,
      0x00, // byte rate (8000)
      0x01,
      0x00, // block align (1)
      0x08,
      0x00, // bits per sample (8)
      0x64,
      0x61,
      0x74,
      0x61, // "data"
      0x00,
      0x1f,
      0x00,
      0x00, // chunk size (8000 bytes)
    ]);
    const silentWavData = Buffer.alloc(8000, 128); // 8-bit PCM silence is 128
    const silentWav = Buffer.concat([silentWavHeader, silentWavData]);
    const audioDataUrl = `data:audio/wav;base64,${silentWav.toString("base64")}`;

    const base64Png =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
    const imageDataUrl = `data:image/png;base64,${base64Png}`;

    // 4. Create an asset in DB
    const asset = await prisma.asset.create({
      data: {
        projectId: project.id,
        kind: "image",
        path: imageDataUrl,
        source: "external",
        status: "ready",
      },
    });

    // 5. Create scenes with valid audio hashes
    const scene1AudioHash = buildSceneAudioHash({
      script: "Primeira cena.",
      voiceProfileId: voiceProfile.id,
    });
    const scene2AudioHash = buildSceneAudioHash({
      script: "Segunda cena.",
      voiceProfileId: voiceProfile.id,
    });

    // We intentionally create scene 2 before scene 1 to test that buildVideoTimeline sorts them correctly by orderIndex!
    await prisma.scene.create({
      data: {
        projectId: project.id,
        orderIndex: 1,
        title: "Fechamento",
        script: "Segunda cena.",
        status: "ready",
        assetId: asset.id,
        audioPath: audioDataUrl,
        audioDurationSeconds: 1.0,
        audioContentHash: scene2AudioHash,
        voiceProfileId: voiceProfile.id,
      },
    });

    await prisma.scene.create({
      data: {
        projectId: project.id,
        orderIndex: 0,
        title: "Abertura",
        script: "Primeira cena.",
        status: "ready",
        assetId: asset.id,
        audioPath: audioDataUrl,
        audioDurationSeconds: 1.0,
        audioContentHash: scene1AudioHash,
        voiceProfileId: voiceProfile.id,
      },
    });

    // 6. Build the timeline props
    const timelineProps = await buildVideoTimeline(
      project.id,
      "http://127.0.0.1:3000",
    );

    expect(timelineProps.scenes).toHaveLength(2);
    expect(timelineProps.scenes![0].script).toBe("Primeira cena.");
    expect(timelineProps.scenes![0].orderIndex).toBe(0);
    expect(timelineProps.scenes![1].script).toBe("Segunda cena.");
    expect(timelineProps.scenes![1].orderIndex).toBe(1);

    // 7. Render the video
    await renderVideo(timelineProps, outputPath);

    expect(existsSync(outputPath)).toBe(true);
  }, 240000);
});
