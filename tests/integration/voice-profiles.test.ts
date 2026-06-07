import { execFileSync } from "node:child_process";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

const databaseName = `open_video_studio_voice_profiles_${process.pid}`;
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

function createMultipartBody(
  fields: Record<string, string>,
  file?: { buffer: Buffer; fileName: string; mimeType: string },
) {
  const boundary = "----open-video-studio-boundary";
  const chunks: Buffer[] = [];

  for (const [key, value] of Object.entries(fields)) {
    chunks.push(Buffer.from(`--${boundary}\r\n`));
    chunks.push(
      Buffer.from(`Content-Disposition: form-data; name="${key}"\r\n\r\n`),
    );
    chunks.push(Buffer.from(`${value}\r\n`));
  }

  if (file) {
    chunks.push(Buffer.from(`--${boundary}\r\n`));
    chunks.push(
      Buffer.from(
        `Content-Disposition: form-data; name="sample"; filename="${file.fileName}"\r\nContent-Type: ${file.mimeType}\r\n\r\n`,
      ),
    );
    chunks.push(file.buffer);
    chunks.push(Buffer.from("\r\n"));
  }

  chunks.push(Buffer.from(`--${boundary}--\r\n`));

  return {
    body: Buffer.concat(chunks),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

// let startedPostgresForSuite = false;

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
    // startedPostgresForSuite = true;
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
  const { prisma } = await import("../../packages/database/src/client.js");
  await prisma.$disconnect();

  await runPsqlWithRetry(
    `DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE);`,
  );

  // if (startedPostgresForSuite) {
  //   runDockerCommand([...composeArgs, "down"]);
  // }
});

describe("voice profiles api routes (integration)", () => {
  it("creates and lists a persisted voice profile from a valid upload", async () => {
    const { buildApiApp } = await import("../../apps/api/src/app.js");
    const app = buildApiApp();
    await app.ready();

    const multipart = createMultipartBody(
      { name: "Narrador Teste" },
      {
        buffer: buildWavBuffer(3.4),
        fileName: "voice.wav",
        mimeType: "audio/wav",
      },
    );

    const createResponse = await app.inject({
      method: "POST",
      url: "/voice-profiles",
      headers: {
        "content-type": multipart.contentType,
      },
      payload: multipart.body,
    });

    expect(createResponse.statusCode).toBe(201);
    const created = JSON.parse(createResponse.body) as {
      id: string;
      name: string;
      provider: string;
      sampleDurationSeconds: number;
      sampleMimeType: string;
      samplePath: string;
    };

    expect(created.name).toBe("Narrador Teste");
    expect(created.provider).toBe("omnivoice-studio");
    expect(created.sampleDurationSeconds).toBe(3.4);
    expect(created.sampleMimeType).toBe("audio/wav");
    expect(created.samplePath).toContain(
      `audio/voice-profiles/${created.id}.wav`,
    );

    const listResponse = await app.inject({
      method: "GET",
      url: "/voice-profiles",
    });

    expect(listResponse.statusCode).toBe(200);
    const list = JSON.parse(listResponse.body) as Array<{
      id: string;
      name: string;
    }>;
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      id: created.id,
      name: "Narrador Teste",
    });

    await app.close();
  });

  it("rejects invalid samples with a clear message", async () => {
    const { buildApiApp } = await import("../../apps/api/src/app.js");
    const app = buildApiApp();
    await app.ready();

    const multipart = createMultipartBody(
      { name: "Narrador Inválido" },
      {
        buffer: Buffer.from("invalid"),
        fileName: "voice.mp3",
        mimeType: "audio/mpeg",
      },
    );

    const response = await app.inject({
      method: "POST",
      url: "/voice-profiles",
      headers: {
        "content-type": multipart.contentType,
      },
      payload: multipart.body,
    });

    expect(response.statusCode).toBe(400);
    expect(response.body).toContain("Formato de áudio inválido");

    await app.close();
  });
});
