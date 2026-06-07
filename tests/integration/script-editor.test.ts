/**
 * Teste de integração — PATCH /projects/:id/script
 *
 * Valida edição persistente do roteiro e comportamento do endpoint.
 */
import { execFileSync } from "node:child_process";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

const composeArgs = [
  "compose",
  "-p",
  "open-video-studio-database",
  "-f",
  "docker-compose.database.yml",
];
const databaseName = `open_video_studio_editor_test_${process.pid}`;
const databaseUrl = `postgresql://postgres:postgres@127.0.0.1:54329/${databaseName}?schema=public`;

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
    // startedPostgresForSuite = true;
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
  // if (startedPostgresForSuite) {
  //   runDockerCommand([...composeArgs, "down"]);
  // }
});

describe("PATCH /projects/:id/script", () => {
  it("persiste rawScript e muda status de draft para scripting", async () => {
    const { buildApiApp } = await import("../../apps/api/src/app.js");
    const { prisma } = await import("../../packages/database/src/client.js");
    const app = buildApiApp();
    await app.ready();

    // Cria projeto diretamente no banco
    const project = await prisma.project.create({
      data: { title: "Projeto Editor Test", status: "draft" },
    });

    const newScript =
      "[CENA 1]\n\nTexto editado pelo usuário\n\n[CENA 2]\n\nConteúdo da cena 2";

    const response = await app.inject({
      method: "PATCH",
      url: `/projects/${project.id}/script`,
      payload: { rawScript: newScript },
    });

    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body) as {
      id: string;
      rawScript: string | null;
      status: string;
      estimatedDuration: number;
      estimatedDurationMin: number;
      estimatedDurationMax: number;
    };

    expect(body.id).toBe(project.id);
    expect(body.rawScript).toBe(newScript);
    expect(body.status).toBe("scripting");
    expect(body.estimatedDuration).toBe(3);
    expect(body.estimatedDurationMin).toBe(3);
    expect(body.estimatedDurationMax).toBe(4);

    await app.close();
  });

  it("persiste e permite recuperar via GET /projects/:id", async () => {
    const { buildApiApp } = await import("../../apps/api/src/app.js");
    const { prisma } = await import("../../packages/database/src/client.js");
    const app = buildApiApp();
    await app.ready();

    const project = await prisma.project.create({
      data: {
        title: "Projeto Reload Test",
        status: "scripting",
        rawScript: "script inicial",
      },
    });

    const editedScript = "[CENA 1]\n\nScript editado e persistido";

    await app.inject({
      method: "PATCH",
      url: `/projects/${project.id}/script`,
      payload: { rawScript: editedScript },
    });

    // Simula "reload" — busca novamente
    const getResponse = await app.inject({
      method: "GET",
      url: `/projects/${project.id}`,
    });

    expect(getResponse.statusCode).toBe(200);

    const fetched = JSON.parse(getResponse.body) as {
      rawScript: string | null;
      estimatedDuration: number;
      estimatedDurationMin: number;
      estimatedDurationMax: number;
    };

    expect(fetched.rawScript).toBe(editedScript);
    expect(fetched.estimatedDuration).toBe(2);
    expect(fetched.estimatedDurationMin).toBe(2);
    expect(fetched.estimatedDurationMax).toBe(2);

    await app.close();
  });

  it("retorna 400 quando rawScript não é fornecido", async () => {
    const { buildApiApp } = await import("../../apps/api/src/app.js");
    const { prisma } = await import("../../packages/database/src/client.js");
    const app = buildApiApp();
    await app.ready();

    const project = await prisma.project.create({
      data: { title: "Projeto Validação", status: "draft" },
    });

    const response = await app.inject({
      method: "PATCH",
      url: `/projects/${project.id}/script`,
      payload: {},
    });

    expect(response.statusCode).toBe(400);

    await app.close();
  });

  it("retorna 404 para projeto inexistente", async () => {
    const { buildApiApp } = await import("../../apps/api/src/app.js");
    const app = buildApiApp();
    await app.ready();

    const response = await app.inject({
      method: "PATCH",
      url: "/projects/projeto-que-nao-existe/script",
      payload: { rawScript: "texto" },
    });

    expect(response.statusCode).toBe(404);

    await app.close();
  });
});
