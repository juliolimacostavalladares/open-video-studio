import { execFileSync } from "node:child_process";

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";

const databaseName = `open_video_studio_scene_assets_${process.pid}`;
const databaseUrl = `postgresql://postgres:postgres@127.0.0.1:54329/${databaseName}?schema=public`;
process.env.DATABASE_URL = databaseUrl;
process.env.STORAGE_DRIVER = "local";
process.env.STORAGE_BASE_PATH = ".tmp/storage-tests";

const composeArgs = [
  "compose",
  "-p",
  "open-video-studio-database",
  "-f",
  "docker-compose.database.yml",
];

function createMultipartBody(file: {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
}) {
  const boundary = "----open-video-studio-boundary";
  const chunks: Buffer[] = [];

  chunks.push(Buffer.from(`--${boundary}\r\n`));
  chunks.push(
    Buffer.from(
      `Content-Disposition: form-data; name="asset"; filename="${file.fileName}"\r\nContent-Type: ${file.mimeType}\r\n\r\n`,
    ),
  );
  chunks.push(file.buffer);
  chunks.push(Buffer.from("\r\n"));
  chunks.push(Buffer.from(`--${boundary}--\r\n`));

  return {
    body: Buffer.concat(chunks),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

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

describe("scene asset upload (integration)", () => {
  it("allows uploading an asset manually and associating it to a scene", async () => {
    const { prisma } = await import("../../packages/database/src/client.js");

    const project = await prisma.project.create({
      data: {
        title: "Test Asset Upload Project",
        status: "draft",
      },
    });

    const scene = await prisma.scene.create({
      data: {
        projectId: project.id,
        orderIndex: 0,
        title: "Scene 1",
        script: "Hello world scene script",
        status: "draft",
      },
    });

    const mockPngBuffer = Buffer.from("fake-png-binary-data");
    const { body, contentType } = createMultipartBody({
      buffer: mockPngBuffer,
      fileName: "test-scene-asset.png",
      mimeType: "image/png",
    });

    const response = await app.inject({
      method: "POST",
      url: `/projects/${project.id}/scenes/${scene.id}/asset`,
      headers: {
        "content-type": contentType,
      },
      payload: body,
    });

    expect(response.statusCode).toBe(200);
    const bodyJson = JSON.parse(response.body);

    expect(bodyJson.id).toBe(scene.id);
    expect(bodyJson.assetId).toBeDefined();
    expect(bodyJson.asset).toMatchObject({
      kind: "image",
      source: "upload",
      status: "ready",
    });
    expect(bodyJson.asset.path).toContain("assets/manual/");

    // Check database to ensure the asset is associated
    const sceneInDb = await prisma.scene.findUnique({
      where: { id: scene.id },
      include: { asset: true },
    });

    expect(sceneInDb?.assetId).toBe(bodyJson.assetId);
    expect(sceneInDb?.asset).toBeDefined();
    expect(sceneInDb?.asset?.kind).toBe("image");
    expect(sceneInDb?.asset?.source).toBe("upload");
  });

  it("returns 400 when trying to upload an invalid file extension/mimetype", async () => {
    const { prisma } = await import("../../packages/database/src/client.js");

    const project = await prisma.project.create({
      data: {
        title: "Test Asset Upload Fail Project",
        status: "draft",
      },
    });

    const scene = await prisma.scene.create({
      data: {
        projectId: project.id,
        orderIndex: 0,
        title: "Scene 1",
        script: "Hello world scene script",
        status: "draft",
      },
    });

    const mockPdfBuffer = Buffer.from("fake-pdf-binary-data");
    const { body, contentType } = createMultipartBody({
      buffer: mockPdfBuffer,
      fileName: "test-doc.pdf",
      mimeType: "application/pdf",
    });

    const response = await app.inject({
      method: "POST",
      url: `/projects/${project.id}/scenes/${scene.id}/asset`,
      headers: {
        "content-type": contentType,
      },
      payload: body,
    });

    expect(response.statusCode).toBe(400);
    const bodyJson = JSON.parse(response.body);
    expect(bodyJson.error).toBe("BAD_REQUEST");
    expect(bodyJson.message).toContain("Formato de arquivo inválido");
  });

  it("returns 404 for non-existent scene or project", async () => {
    const mockPngBuffer = Buffer.from("fake-png-binary-data");
    const { body, contentType } = createMultipartBody({
      buffer: mockPngBuffer,
      fileName: "test-scene-asset.png",
      mimeType: "image/png",
    });

    const response = await app.inject({
      method: "POST",
      url: `/projects/non-existent-proj/scenes/non-existent-scene/asset`,
      headers: {
        "content-type": contentType,
      },
      payload: body,
    });

    expect(response.statusCode).toBe(404);
  });
});
