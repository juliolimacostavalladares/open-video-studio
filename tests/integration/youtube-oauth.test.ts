import { execFileSync } from "node:child_process";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

const composeArgs = [
  "compose",
  "-p",
  "open-video-studio-database",
  "-f",
  "docker-compose.database.yml",
];
const databaseName = `open_video_studio_youtube_oauth_test_${process.pid}`;
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
});

afterAll(async () => {
  const { prisma } = await import("../../packages/database/src/client.js");
  await prisma.$disconnect();
  runPsqlWithRetry(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE);`);
});

describe("YouTube OAuth2 API endpoints", () => {
  it("GET /youtube/auth-url returns a mock google oauth url", async () => {
    const { buildApiApp } = await import("../../apps/api/src/app.js");
    const app = buildApiApp();
    await app.ready();

    const response = await app.inject({
      method: "GET",
      url: "/youtube/auth-url?projectId=my-project-id",
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as { url: string };
    expect(body.url).toContain("mock_code");
    expect(body.url).toContain("state=my-project-id");

    await app.close();
  });

  it("GET /youtube/callback with mock parameters creates channel, links to project and redirects", async () => {
    const { buildApiApp } = await import("../../apps/api/src/app.js");
    const { prisma } = await import("../../packages/database/src/client.js");
    const app = buildApiApp();
    await app.ready();

    // Create a mock project
    const project = await prisma.project.create({
      data: {
        title: "OAuth Test Project",
        status: "draft",
      },
    });

    const response = await app.inject({
      method: "GET",
      url: `/youtube/callback?code=mock_code&state=${project.id}`,
    });

    // It should redirect
    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toContain(
      "/projects/" + project.id + "/review?oauth=success",
    );

    // Let's verify the project is linked to a connected channel
    const updatedProject = await prisma.project.findUnique({
      where: { id: project.id },
      include: { youtubeChannel: true },
    });

    expect(updatedProject?.youtubeChannelId).toBeTruthy();
    expect(updatedProject?.youtubeChannel?.channelId).toBe(
      "UC_MOCK_CHANNEL_ID_12345",
    );
    expect(updatedProject?.youtubeChannel?.title).toBe(
      "Mock Channel Solo Operator",
    );

    await app.close();
  });

  it("GET /projects/:id/youtube-channel returns connected channel info or null", async () => {
    const { buildApiApp } = await import("../../apps/api/src/app.js");
    const { prisma } = await import("../../packages/database/src/client.js");
    const app = buildApiApp();
    await app.ready();

    // Project without connected channel
    const projectNoChannel = await prisma.project.create({
      data: {
        title: "No Channel Project",
        status: "draft",
      },
    });

    const res1 = await app.inject({
      method: "GET",
      url: `/projects/${projectNoChannel.id}/youtube-channel`,
    });

    expect(res1.statusCode).toBe(200);
    expect(res1.body).toBe("null");

    // Link it manually to test the GET endpoint
    const channel = await prisma.youtubeChannel.create({
      data: {
        channelId: "UC_SOME_CHANNEL_ID",
        title: "Some YouTube Channel",
        accessToken: "some_access",
        refreshToken: "some_refresh",
        expiryDate: new Date(),
      },
    });

    const projectWithChannel = await prisma.project.create({
      data: {
        title: "With Channel Project",
        status: "draft",
        youtubeChannelId: channel.id,
      },
    });

    const res2 = await app.inject({
      method: "GET",
      url: `/projects/${projectWithChannel.id}/youtube-channel`,
    });

    expect(res2.statusCode).toBe(200);
    const body = JSON.parse(res2.body) as { title: string; channelId: string };
    expect(body.title).toBe("Some YouTube Channel");
    expect(body.channelId).toBe("UC_SOME_CHANNEL_ID");

    await app.close();
  });

  it("GET /youtube/callback with error query parameter redirects with oauth=error", async () => {
    const { buildApiApp } = await import("../../apps/api/src/app.js");
    const app = buildApiApp();
    await app.ready();

    const response = await app.inject({
      method: "GET",
      url: "/youtube/callback?error=access_denied&state=my-project-id",
    });

    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toContain(
      "/projects/my-project-id/review?oauth=error",
    );
    expect(response.headers.location).toContain("access_denied");

    await app.close();
  });
});
