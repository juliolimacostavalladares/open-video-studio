import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const composeArgs = [
  "compose",
  "-p",
  "open-video-studio-database",
  "-f",
  "docker-compose.database.yml",
];
const databaseName = `open_video_studio_youtube_publish_test_${process.pid}`;
const databaseUrl = `postgresql://postgres:postgres@127.0.0.1:54329/${databaseName}?schema=public`;

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

function runPsqlWithRetry(sql: string, attempts = 10) {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
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
    }
  }
  throw lastError;
}

beforeAll(async () => {
  process.env.YOUTUBE_MOCK_MODE = "true";

  if (!isPostgresRunning()) {
    runDockerCommand([...composeArgs, "up", "-d", "postgres"]);
  }

  await waitForPostgres();
  runPsqlWithRetry(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE);`);
  runPsqlWithRetry(`CREATE DATABASE "${databaseName}";`);
  process.env.DATABASE_URL = databaseUrl;

  execFileSync(
    "pnpm",
    ["--filter", "@repo/database", "exec", "prisma", "migrate", "deploy"],
    {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: "pipe",
    },
  );

  fs.mkdirSync(join(process.cwd(), ".tmp"), { recursive: true });
});

afterAll(async () => {
  const { prisma } = await import("../../packages/database/src/client.js");
  await prisma.$disconnect();
  runPsqlWithRetry(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE);`);
  delete process.env.YOUTUBE_MOCK_MODE;
});

describe("YouTube Publish API Endpoint", () => {
  it("rejects publish if project is not approved", async () => {
    const { buildApiApp } = await import("../../apps/api/src/app.js");
    const { prisma } = await import("../../packages/database/src/client.js");
    const app = buildApiApp();
    await app.ready();

    const project = await prisma.project.create({
      data: {
        title: "Draft Project",
        status: "draft",
      },
    });

    const res = await app.inject({
      method: "POST",
      url: `/projects/${project.id}/publish`,
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.message).toContain("aprovado");

    await app.close();
  });

  it("rejects publish if no YouTube channel is connected", async () => {
    const { buildApiApp } = await import("../../apps/api/src/app.js");
    const { prisma } = await import("../../packages/database/src/client.js");
    const app = buildApiApp();
    await app.ready();

    const project = await prisma.project.create({
      data: {
        title: "Approved Project No Channel",
        status: "approved",
      },
    });

    const res = await app.inject({
      method: "POST",
      url: `/projects/${project.id}/publish`,
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.message).toContain("canal do YouTube");

    await app.close();
  });

  it("rejects publish if no succeeded render job exists", async () => {
    const { buildApiApp } = await import("../../apps/api/src/app.js");
    const { prisma } = await import("../../packages/database/src/client.js");
    const app = buildApiApp();
    await app.ready();

    const channel = await prisma.youtubeChannel.create({
      data: {
        channelId: "UC_PUBLISH_TEST_CHANNEL",
        title: "Test Channel",
        accessToken: "mock_access_token",
        refreshToken: "mock_refresh_token",
        expiryDate: new Date(Date.now() + 3600 * 1000),
      },
    });

    const project = await prisma.project.create({
      data: {
        title: "Approved Project No Render",
        status: "approved",
        youtubeChannelId: channel.id,
      },
    });

    const res = await app.inject({
      method: "POST",
      url: `/projects/${project.id}/publish`,
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.message).toContain("render finalizado");

    await app.close();
  });

  it("publishes successfully, updating project with video id and publishedAt timestamp", async () => {
    const { buildApiApp } = await import("../../apps/api/src/app.js");
    const { prisma } = await import("../../packages/database/src/client.js");
    const app = buildApiApp();
    await app.ready();

    const channel = await prisma.youtubeChannel.create({
      data: {
        channelId: "UC_PUBLISH_SUCCESS_CHANNEL",
        title: "Success Channel",
        accessToken: "mock_access_token",
        refreshToken: "mock_refresh_token",
        expiryDate: new Date(Date.now() + 3600 * 1000),
      },
    });

    const project = await prisma.project.create({
      data: {
        title: "Approved Project Success Publish",
        status: "approved",
        youtubeChannelId: channel.id,
      },
    });

    // Create a dummy video file
    const dummyVideoPath = join(
      process.cwd(),
      `.tmp/dummy-video-${project.id}.mp4`,
    );
    fs.writeFileSync(dummyVideoPath, "dummy-video-content");

    await prisma.renderJob.create({
      data: {
        projectId: project.id,
        status: "succeeded",
        outputPath: dummyVideoPath,
      },
    });

    const res = await app.inject({
      method: "POST",
      url: `/projects/${project.id}/publish`,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.videoId).toBe("mock_youtube_video_id_998877");
    expect(body.url).toContain("mock_youtube_video_id_998877");

    // Verify database project is updated
    const updated = await prisma.project.findUnique({
      where: { id: project.id },
    });

    expect(updated?.youtubeVideoId).toBe("mock_youtube_video_id_998877");
    expect(updated?.youtubePublishError).toBeNull();
    expect(updated?.publishedAt).toBeTruthy();

    // Cleanup dummy video file
    if (fs.existsSync(dummyVideoPath)) {
      fs.unlinkSync(dummyVideoPath);
    }

    await app.close();
  });

  it("rejects publish if scheduled date is in the past", async () => {
    const { buildApiApp } = await import("../../apps/api/src/app.js");
    const { prisma } = await import("../../packages/database/src/client.js");
    const app = buildApiApp();
    await app.ready();

    const channel = await prisma.youtubeChannel.create({
      data: {
        channelId: "UC_PUBLISH_PAST_CHANNEL",
        title: "Past Channel",
        accessToken: "mock_access_token",
        refreshToken: "mock_refresh_token",
        expiryDate: new Date(Date.now() + 3600 * 1000),
      },
    });

    const project = await prisma.project.create({
      data: {
        title: "Approved Project Past Schedule",
        status: "approved",
        youtubeChannelId: channel.id,
      },
    });

    const res = await app.inject({
      method: "POST",
      url: `/projects/${project.id}/publish`,
      body: {
        scheduledPublishAtLocal: "2020-01-01 12:00",
        scheduledPublishTimezone: "America/Sao_Paulo",
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.message).toContain("futuro");

    await app.close();
  });

  it("schedules successfully, converting timezone and updating project fields", async () => {
    const { buildApiApp } = await import("../../apps/api/src/app.js");
    const { prisma } = await import("../../packages/database/src/client.js");
    const app = buildApiApp();
    await app.ready();

    const channel = await prisma.youtubeChannel.create({
      data: {
        channelId: "UC_PUBLISH_SCHED_CHANNEL",
        title: "Sched Channel",
        accessToken: "mock_access_token",
        refreshToken: "mock_refresh_token",
        expiryDate: new Date(Date.now() + 3600 * 1000),
      },
    });

    const project = await prisma.project.create({
      data: {
        title: "Approved Project Sched Publish",
        status: "approved",
        youtubeChannelId: channel.id,
      },
    });

    const dummyVideoPath = join(
      process.cwd(),
      `.tmp/dummy-video-${project.id}.mp4`,
    );
    fs.writeFileSync(dummyVideoPath, "dummy-video-content");

    await prisma.renderJob.create({
      data: {
        projectId: project.id,
        status: "succeeded",
        outputPath: dummyVideoPath,
      },
    });

    // Schedule for a date in the future (e.g. 2030-06-12 15:30)
    const res = await app.inject({
      method: "POST",
      url: `/projects/${project.id}/publish`,
      body: {
        scheduledPublishAtLocal: "2030-06-12 15:30",
        scheduledPublishTimezone: "America/Sao_Paulo",
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.message).toContain("agendado");

    const updated = await prisma.project.findUnique({
      where: { id: project.id },
    });

    // publishedAt should be null (since it's scheduled)
    expect(updated?.publishedAt).toBeNull();
    expect(updated?.scheduledPublishAtLocal).toBe("2030-06-12 15:30");
    expect(updated?.scheduledPublishTimezone).toBe("America/Sao_Paulo");

    // America/Sao_Paulo is UTC-3, so 15:30 local should be 18:30 UTC
    expect(updated?.scheduledPublishAt?.toISOString()).toBe(
      "2030-06-12T18:30:00.000Z",
    );

    if (fs.existsSync(dummyVideoPath)) {
      fs.unlinkSync(dummyVideoPath);
    }

    await app.close();
  });

  it("handles quota exceeded error and enters download_only mode", async () => {
    const { buildApiApp } = await import("../../apps/api/src/app.js");
    const { prisma } = await import("../../packages/database/src/client.js");
    const app = buildApiApp();
    await app.ready();

    const channel = await prisma.youtubeChannel.create({
      data: {
        channelId: "UC_PUBLISH_QUOTA_CHANNEL",
        title: "Quota Channel",
        accessToken: "mock_access_token_quota_error",
        refreshToken: "mock_refresh_token",
        expiryDate: new Date(Date.now() + 3600 * 1000),
      },
    });

    const project = await prisma.project.create({
      data: {
        title: "Approved Project Quota Fallback",
        status: "approved",
        youtubeChannelId: channel.id,
      },
    });

    const dummyVideoPath = join(
      process.cwd(),
      `.tmp/dummy-video-${project.id}.mp4`,
    );
    fs.writeFileSync(dummyVideoPath, "dummy-video-content");

    await prisma.renderJob.create({
      data: {
        projectId: project.id,
        status: "succeeded",
        outputPath: dummyVideoPath,
      },
    });

    const res = await app.inject({
      method: "POST",
      url: `/projects/${project.id}/publish`,
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.error).toBe("QUOTA_EXCEEDED");

    const updated = await prisma.project.findUnique({
      where: { id: project.id },
    });
    expect(updated?.youtubePublishStatus).toBe("download_only");
    expect(updated?.youtubePublishError).toContain("quota");

    // Test reset endpoint
    const resetRes = await app.inject({
      method: "POST",
      url: `/projects/${project.id}/youtube/reset`,
    });
    expect(resetRes.statusCode).toBe(200);

    const resetUpdated = await prisma.project.findUnique({
      where: { id: project.id },
    });
    expect(resetUpdated?.youtubePublishStatus).toBe("idle");
    expect(resetUpdated?.youtubePublishError).toBeNull();

    if (fs.existsSync(dummyVideoPath)) {
      fs.unlinkSync(dummyVideoPath);
    }

    await app.close();
  });
});
