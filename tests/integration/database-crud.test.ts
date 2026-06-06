import { execFileSync } from "node:child_process";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

const composeArgs = ["compose", "-p", "open-video-studio-database", "-f", "docker-compose.database.yml"];
const databaseName = `open_video_studio_test_${process.pid}`;
const databaseUrl = `postgresql://postgres:postgres@127.0.0.1:54329/${databaseName}?schema=public`;

let startedPostgresForSuite = false;

function runDockerCommand(args: string[]) {
  return execFileSync("docker", args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: "pipe",
    encoding: "utf-8"
  });
}

function isPostgresRunning() {
  const output = runDockerCommand([...composeArgs, "ps", "--status", "running", "--services"]);

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
        "postgres"
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
    sql
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
    startedPostgresForSuite = true;
  }

  await waitForPostgres();

  await runPsqlWithRetry(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE);`);
  await runPsqlWithRetry(`CREATE DATABASE "${databaseName}";`);

  process.env.DATABASE_URL = databaseUrl;

  execFileSync("pnpm", ["--filter", "@repo/database", "exec", "prisma", "migrate", "deploy"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl
    },
    stdio: "pipe"
  });
});

afterAll(async () => {
  const { prisma } = await import("../../packages/database/src/client.js");
  await prisma.$disconnect();

  await runPsqlWithRetry(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE);`);

  if (startedPostgresForSuite) {
    runDockerCommand([...composeArgs, "down"]);
  }
});

describe("database package", () => {
  it("persists project and scene relationships", async () => {
    const { prisma } = await import("../../packages/database/src/client.js");

    const project = await prisma.project.create({
      data: {
        title: "Integration Project",
        status: "draft"
      }
    });

    const scene = await prisma.scene.create({
      data: {
        orderIndex: 0,
        projectId: project.id,
        script: "Cena de teste",
        status: "draft",
        title: "Cena 1"
      }
    });

    const storedProject = await prisma.project.findUnique({
      where: { id: project.id },
      include: { scenes: true }
    });

    expect(storedProject?.scenes).toHaveLength(1);
    expect(storedProject?.scenes[0]?.id).toBe(scene.id);
  });
});
