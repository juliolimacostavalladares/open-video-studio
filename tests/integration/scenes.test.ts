const databaseName = `open_video_studio_test_scenes_${process.pid}`;
const databaseUrl = `postgresql://postgres:postgres@127.0.0.1:54329/${databaseName}?schema=public`;
process.env.DATABASE_URL = databaseUrl;

const composeArgs = ["compose", "-p", "open-video-studio-database", "-f", "docker-compose.database.yml"];

import { execFileSync } from "node:child_process";

import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let app: FastifyInstance;

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

  const { buildApiApp } = await import("../../apps/api/src/app.js");
  app = buildApiApp();
});

afterAll(async () => {
  const { prisma } = await import("../../packages/database/src/client.js");
  await prisma.$disconnect();

  await runPsqlWithRetry(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE);`);

  if (startedPostgresForSuite) {
    runDockerCommand([...composeArgs, "down"]);
  }
});

describe("scenes api routes (integration)", () => {
  it("performs recomposition and listing of scenes via endpoints", async () => {
    const { prisma } = await import("../../packages/database/src/client.js");

    // 1. Cria um projeto de teste no banco
    const project = await prisma.project.create({
      data: {
        title: "Recomposition Project",
        rawScript: `[CENA 1 - Abertura]
Texto da cena de abertura.

[CENA 2 - Desenvolvimento]
Explicação detalhada do assunto.`,
        status: "draft"
      }
    });

    // 2. Chama a rota de recomposição (POST /projects/:id/scenes/recompose)
    const recomposeRes = await app.inject({
      method: "POST",
      url: `/projects/${project.id}/scenes/recompose`
    });

    expect(recomposeRes.statusCode).toBe(200);
    const recomposeBody = JSON.parse(recomposeRes.body);

    expect(recomposeBody.projectId).toBe(project.id);
    expect(recomposeBody.scenesCreated).toBe(2);
    expect(recomposeBody.scenesDeleted).toBe(0);
    expect(recomposeBody.scenes).toHaveLength(2);
    expect(recomposeBody.scenes[0]).toMatchObject({
      sceneNumber: 1,
      title: "Abertura",
      orderIndex: 0,
      script: "Texto da cena de abertura."
    });
    expect(recomposeBody.scenes[1]).toMatchObject({
      sceneNumber: 2,
      title: "Desenvolvimento",
      orderIndex: 1,
      script: "Explicação detalhada do assunto."
    });

    // 3. Verifica no banco se as cenas foram realmente criadas
    const scenesInDb = await prisma.scene.findMany({
      where: { projectId: project.id },
      orderBy: { orderIndex: "asc" }
    });
    expect(scenesInDb).toHaveLength(2);

    // 4. Chama a rota de listagem (GET /projects/:id/scenes)
    const listRes = await app.inject({
      method: "GET",
      url: `/projects/${project.id}/scenes`
    });

    expect(listRes.statusCode).toBe(200);
    const listBody = JSON.parse(listRes.body);
    expect(listBody.projectId).toBe(project.id);
    expect(listBody.scenes).toHaveLength(2);
    expect(listBody.scenes[0].title).toBe("Abertura");

    // 5. Atualiza o rawScript do projeto para simular uma edição
    await prisma.project.update({
      where: { id: project.id },
      data: {
        rawScript: `[CENA 2 - Desenvolvimento Editado]
Texto novo do desenvolvimento.

[CENA 3 - Encerramento]
Mensagem final.`
      }
    });

    // 6. Recompõe novamente e verifica idempotência / atualização
    const secondRecomposeRes = await app.inject({
      method: "POST",
      url: `/projects/${project.id}/scenes/recompose`
    });

    expect(secondRecomposeRes.statusCode).toBe(200);
    const secondRecomposeBody = JSON.parse(secondRecomposeRes.body);

    // Deve ter deletado as 2 cenas antigas e criado 2 novas
    expect(secondRecomposeBody.scenesCreated).toBe(2);
    expect(secondRecomposeBody.scenesDeleted).toBe(2);
    expect(secondRecomposeBody.scenes).toHaveLength(2);
    expect(secondRecomposeBody.scenes[0]).toMatchObject({
      sceneNumber: 2,
      title: "Desenvolvimento Editado",
      orderIndex: 0,
      script: "Texto novo do desenvolvimento."
    });
    expect(secondRecomposeBody.scenes[1]).toMatchObject({
      sceneNumber: 3,
      title: "Encerramento",
      orderIndex: 1,
      script: "Mensagem final."
    });
  });

  it("returns 404 for non-existent projects", async () => {

    const recomposeRes = await app.inject({
      method: "POST",
      url: `/projects/non-existent-id/scenes/recompose`
    });
    expect(recomposeRes.statusCode).toBe(404);

    const listRes = await app.inject({
      method: "GET",
      url: `/projects/non-existent-id/scenes`
    });
    expect(listRes.statusCode).toBe(404);
  });

  it("returns 422 when rawScript is missing or empty", async () => {
    const { prisma } = await import("../../packages/database/src/client.js");

    const project = await prisma.project.create({
      data: {
        title: "Empty Project",
        status: "draft"
      }
    });

    const recomposeRes = await app.inject({
      method: "POST",
      url: `/projects/${project.id}/scenes/recompose`
    });
    expect(recomposeRes.statusCode).toBe(422);
  });
});
