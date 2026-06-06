/**
 * Teste de integração — POST /projects
 *
 * Valida criação de projeto, geração de roteiro e persistência.
 * Usa cliente mock de IA (AI_PROVIDER=mock) e banco de teste isolado.
 */
import { execFileSync } from "node:child_process";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

const composeArgs = ["compose", "-p", "open-video-studio-database", "-f", "docker-compose.database.yml"];
const databaseName = `open_video_studio_projects_test_${process.pid}`;
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
      runDockerCommand([...composeArgs, "exec", "-T", "postgres", "pg_isready", "-U", "postgres", "-d", "postgres"]);
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
      runDockerCommand([...composeArgs, "exec", "-T", "postgres", "psql", "-U", "postgres", "-d", "postgres", "-c", sql]);
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
    startedPostgresForSuite = true;
  }

  await waitForPostgres();
  runPsqlWithRetry(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE);`);
  runPsqlWithRetry(`CREATE DATABASE "${databaseName}";`);
  process.env.DATABASE_URL = databaseUrl;
  process.env.AI_PROVIDER = "mock";

  execFileSync("pnpm", ["--filter", "@repo/database", "exec", "prisma", "migrate", "deploy"], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: "pipe"
  });
});

afterAll(async () => {
  const { prisma } = await import("../../packages/database/src/client.js");
  await prisma.$disconnect();
  runPsqlWithRetry(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE);`);
  if (startedPostgresForSuite) {
    runDockerCommand([...composeArgs, "down"]);
  }
});

describe("POST /projects", () => {
  it("cria projeto e persiste roteiro gerado pela IA mock", async () => {
    const { buildApiApp } = await import("../../apps/api/src/app.js");
    const app = buildApiApp();
    await app.ready();

    const response = await app.inject({
      method: "POST",
      url: "/projects",
      payload: {
        title: "Meu Primeiro Vídeo",
        theme: "inteligência artificial",
        tone: "educativo",
        targetDuration: 10
      }
    });

    expect(response.statusCode).toBeOneOf([201, 207]);

    const body = JSON.parse(response.body) as {
      id: string;
      title: string;
      theme: string;
      tone: string;
      targetDuration: number;
      rawScript: string | null;
      status: string;
    };

    expect(body.id).toBeTruthy();
    expect(body.title).toBe("Meu Primeiro Vídeo");
    expect(body.theme).toBe("inteligência artificial");
    expect(body.tone).toBe("educativo");
    expect(body.targetDuration).toBe(10);
    expect(body.status).toBe("scripting");
    expect(body.rawScript).toBeTruthy();
    expect(body.rawScript).toContain("[CENA");

    await app.close();
  });

  it("persiste o roteiro e permite recuperar via GET /projects/:id", async () => {
    const { buildApiApp } = await import("../../apps/api/src/app.js");
    const app = buildApiApp();
    await app.ready();

    const createResponse = await app.inject({
      method: "POST",
      url: "/projects",
      payload: {
        title: "Vídeo de Recuperação",
        theme: "saúde mental",
        tone: "empático",
        targetDuration: 15
      }
    });

    const created = JSON.parse(createResponse.body) as { id: string };
    const id = created.id;

    const getResponse = await app.inject({
      method: "GET",
      url: `/projects/${id}`
    });

    expect(getResponse.statusCode).toBe(200);

    const fetched = JSON.parse(getResponse.body) as {
      id: string;
      rawScript: string | null;
      theme: string;
    };

    expect(fetched.id).toBe(id);
    expect(fetched.theme).toBe("saúde mental");
    expect(fetched.rawScript).toBeTruthy();

    await app.close();
  });

  it("retorna 400 quando campos obrigatórios estão ausentes", async () => {
    const { buildApiApp } = await import("../../apps/api/src/app.js");
    const app = buildApiApp();
    await app.ready();

    const response = await app.inject({
      method: "POST",
      url: "/projects",
      payload: { title: "Incompleto" }
    });

    expect(response.statusCode).toBe(400);

    await app.close();
  });

  it("retorna 404 para projeto inexistente", async () => {
    const { buildApiApp } = await import("../../apps/api/src/app.js");
    const app = buildApiApp();
    await app.ready();

    const response = await app.inject({
      method: "GET",
      url: "/projects/nao-existe-id"
    });

    expect(response.statusCode).toBe(404);

    await app.close();
  });
});
