import { execFileSync } from "node:child_process";

import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const databaseName = `open_video_studio_test_fallback_${process.pid}`;
const databaseUrl = `postgresql://postgres:postgres@127.0.0.1:54329/${databaseName}?schema=public`;
process.env.DATABASE_URL = databaseUrl;

const composeArgs = [
  "compose",
  "-p",
  "open-video-studio-database",
  "-f",
  "docker-compose.database.yml",
];

let app: FastifyInstance;

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

beforeAll(async () => {
  if (!isPostgresRunning()) {
    runDockerCommand([...composeArgs, "up", "-d", "postgres"]);
  }

  await waitForPostgres();

  await runPsqlWithRetry(
    `DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE);`,
  );
  await runPsqlWithRetry(`CREATE DATABASE "${databaseName}";`);

  process.env.DATABASE_URL = databaseUrl;

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
  await prisma.$disconnect();

  await runPsqlWithRetry(
    `DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE);`,
  );
});

describe("scenes fallback integration tests", () => {
  it("automatically assigns a persistent fallback asset when scenes without asset are fetched", async () => {
    const { prisma } = await import("../../packages/database/src/client.js");

    const project = await prisma.project.create({
      data: {
        title: "Fallback Test Project",
        rawScript: `[CENA 1 - Abertura]
Texto da cena de abertura.`,
        status: "draft",
      },
    });

    // 1. Recompose scenes so we have a scene in the DB without asset
    await app.inject({
      method: "POST",
      url: `/projects/${project.id}/scenes/recompose`,
    });

    // Verify scene initially has no assetId
    const initialScene = await prisma.scene.findFirst({
      where: { projectId: project.id },
    });
    expect(initialScene?.assetId).toBeNull();

    // 2. Fetch scenes via GET /projects/:id/scenes, which should trigger the fallback logic
    const getRes = await app.inject({
      method: "GET",
      url: `/projects/${project.id}/scenes`,
    });

    expect(getRes.statusCode).toBe(200);
    const getBody = JSON.parse(getRes.body);

    expect(getBody.scenes).toHaveLength(1);
    const scene = getBody.scenes[0];
    expect(scene.assetId).toBeDefined();
    expect(scene.assetId).not.toBeNull();
    expect(scene.asset).toMatchObject({
      kind: "image",
      source: "external",
      path: "assets/fallbacks/default-placeholder.png",
      status: "ready",
    });

    // Check DB to ensure the asset is persisted and linked
    const sceneInDb = await prisma.scene.findFirst({
      where: { projectId: project.id },
      include: { asset: true },
    });
    expect(sceneInDb?.assetId).toBe(scene.assetId);
    expect(sceneInDb?.asset?.path).toBe(
      "assets/fallbacks/default-placeholder.png",
    );

    // 3. Fetch scenes again and verify it is idempotent (doesn't create a new asset)
    const assetCountBefore = await prisma.asset.count({
      where: { projectId: project.id },
    });
    expect(assetCountBefore).toBe(1);

    const getRes2 = await app.inject({
      method: "GET",
      url: `/projects/${project.id}/scenes`,
    });
    expect(getRes2.statusCode).toBe(200);

    const assetCountAfter = await prisma.asset.count({
      where: { projectId: project.id },
    });
    expect(assetCountAfter).toBe(1);
  });
});
