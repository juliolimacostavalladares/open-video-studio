import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const composeArgs = [
  "compose",
  "-p",
  "open-video-studio-database",
  "-f",
  "docker-compose.database.yml",
];
const databaseName = `open_video_studio_review_test_${process.pid}`;
const databaseUrl = `postgresql://postgres:postgres@127.0.0.1:54329/${databaseName}?schema=public`;

import type { FastifyInstance } from "fastify";

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
  await app.close();
  await prisma.$disconnect();
  await runPsqlWithRetry(
    `DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE);`,
  );
});

describe("Project Review API integration", () => {
  it("should load the project, its scenes, and the succeeded render job", async () => {
    const { prisma } = await import("../../packages/database/src/client.js");

    // Seed Voice Profile
    const voice = await prisma.voiceProfile.create({
      data: {
        name: "Voice for Review",
        provider: "omnivoice-studio",
        samplePath: "audio/voice-profiles/review.wav",
        sampleMimeType: "audio/wav",
        sampleDurationSeconds: 2.5,
        status: "active",
      },
    });

    // Create project
    const project = await prisma.project.create({
      data: {
        title: "Review Test Project",
        description: "A description of the test project under review",
        status: "ready_for_review",
        voiceProfileId: voice.id,
        rawScript: "[CENA 1]\nFirst scene script content.",
      },
    });

    // Create scene
    await prisma.scene.create({
      data: {
        projectId: project.id,
        orderIndex: 0,
        title: "Cena 1",
        script: "First scene script content.",
        status: "ready",
      },
    });

    // Create succeeded render job
    await prisma.renderJob.create({
      data: {
        projectId: project.id,
        status: "succeeded",
        outputPath: "renders/succeeded-render-job.mp4",
      },
    });

    // 1. Fetch project details
    const projectRes = await app.inject({
      method: "GET",
      url: `/projects/${project.id}`,
    });
    expect(projectRes.statusCode).toBe(200);
    const projectBody = JSON.parse(projectRes.body);
    expect(projectBody.title).toBe("Review Test Project");
    expect(projectBody.status).toBe("ready_for_review");
    expect(projectBody.description).toBe(
      "A description of the test project under review",
    );

    // 2. Fetch render job status
    const renderRes = await app.inject({
      method: "GET",
      url: `/projects/${project.id}/renders`,
    });
    expect(renderRes.statusCode).toBe(200);
    const renderBody = JSON.parse(renderRes.body);
    expect(renderBody.status).toBe("succeeded");
    expect(renderBody.outputPath).toBe("renders/succeeded-render-job.mp4");

    // 3. Fetch scenes list
    const scenesRes = await app.inject({
      method: "GET",
      url: `/projects/${project.id}/scenes`,
    });
    expect(scenesRes.statusCode).toBe(200);
    const scenesBody = JSON.parse(scenesRes.body);
    const scenesList = Array.isArray(scenesBody)
      ? scenesBody
      : scenesBody.scenes;
    expect(scenesList).toHaveLength(1);
    expect(scenesList[0].title).toBe("Cena 1");
    expect(scenesList[0].script).toBe("First scene script content.");
  });

  it("returns 404 for renders if no render job exists", async () => {
    const { prisma } = await import("../../packages/database/src/client.js");

    const project = await prisma.project.create({
      data: {
        title: "Empty Project",
        status: "draft",
      },
    });

    const renderRes = await app.inject({
      method: "GET",
      url: `/projects/${project.id}/renders`,
    });
    expect(renderRes.statusCode).toBe(404);
  });

  it("should update project title, description, and tags via PATCH /projects/:id and verify persistence", async () => {
    const { prisma } = await import("../../packages/database/src/client.js");

    const project = await prisma.project.create({
      data: {
        title: "Original Title",
        description: "Original Description",
        status: "draft",
        tags: ["tag1"],
      },
    });

    // 1. Valid PATCH request
    const patchRes = await app.inject({
      method: "PATCH",
      url: `/projects/${project.id}`,
      payload: {
        title: "Updated Title",
        description: "Updated Description",
        tags: ["tag1", "tag2", "new-tag"],
      },
    });

    expect(patchRes.statusCode).toBe(200);
    const patchBody = JSON.parse(patchRes.body);
    expect(patchBody.title).toBe("Updated Title");
    expect(patchBody.description).toBe("Updated Description");
    expect(patchBody.tags).toEqual(["tag1", "tag2", "new-tag"]);

    // 2. Fetch project details and verify persistence in db
    const getRes = await app.inject({
      method: "GET",
      url: `/projects/${project.id}`,
    });
    expect(getRes.statusCode).toBe(200);
    const getBody = JSON.parse(getRes.body);
    expect(getBody.title).toBe("Updated Title");
    expect(getBody.description).toBe("Updated Description");
    expect(getBody.tags).toEqual(["tag1", "tag2", "new-tag"]);

    // 3. Validation failure: empty title
    const invalidTitleRes = await app.inject({
      method: "PATCH",
      url: `/projects/${project.id}`,
      payload: {
        title: "   ",
      },
    });
    expect(invalidTitleRes.statusCode).toBe(400);
    const invalidTitleBody = JSON.parse(invalidTitleRes.body);
    expect(invalidTitleBody.error).toBe("BAD_REQUEST");

    // 4. Validation failure: tags is not an array of strings
    const invalidTagsRes = await app.inject({
      method: "PATCH",
      url: `/projects/${project.id}`,
      payload: {
        tags: ["valid-tag", 123 as never],
      },
    });
    expect(invalidTagsRes.statusCode).toBe(400);
  });

  it("should handle the approval and rejection flow, and invalidate approval on modifications", async () => {
    const { prisma } = await import("../../packages/database/src/client.js");

    // 1. Create a project and attempt to approve it without a successful render job -> should fail
    const project = await prisma.project.create({
      data: {
        title: "Workflow Project",
        status: "ready_for_review",
      },
    });

    const approveFailRes = await app.inject({
      method: "POST",
      url: `/projects/${project.id}/approve`,
    });
    expect(approveFailRes.statusCode).toBe(400);

    // 2. Create a successful render job and approve -> should succeed
    await prisma.renderJob.create({
      data: {
        projectId: project.id,
        status: "succeeded",
        outputPath: "renders/workflow-render.mp4",
      },
    });

    const approveSuccessRes = await app.inject({
      method: "POST",
      url: `/projects/${project.id}/approve`,
    });
    expect(approveSuccessRes.statusCode).toBe(200);
    const approvedProject = JSON.parse(approveSuccessRes.body);
    expect(approvedProject.status).toBe("approved");

    // 3. Modifying metadata of an approved project -> should invalidate to ready_for_review
    const patchMetadataRes = await app.inject({
      method: "PATCH",
      url: `/projects/${project.id}`,
      payload: {
        title: "Workflow Project Edited Title",
      },
    });
    expect(patchMetadataRes.statusCode).toBe(200);
    const patchedProject = JSON.parse(patchMetadataRes.body);
    expect(patchedProject.status).toBe("ready_for_review");

    // 4. Re-approve the project
    const approveSuccessRes2 = await app.inject({
      method: "POST",
      url: `/projects/${project.id}/approve`,
    });
    expect(approveSuccessRes2.statusCode).toBe(200);

    // 5. Modifying script of an approved project -> should invalidate to scripting
    const patchScriptRes = await app.inject({
      method: "PATCH",
      url: `/projects/${project.id}/script`,
      payload: {
        rawScript: "[CENA 1]\nNew different script content.",
      },
    });
    expect(patchScriptRes.statusCode).toBe(200);
    const scriptBody = JSON.parse(patchScriptRes.body);
    expect(scriptBody.status).toBe("scripting");

    // 6. Test rejection transition
    // Reset status to ready_for_review manually for testing
    await prisma.project.update({
      where: { id: project.id },
      data: { status: "ready_for_review" },
    });

    const rejectRes = await app.inject({
      method: "POST",
      url: `/projects/${project.id}/reject`,
    });
    expect(rejectRes.statusCode).toBe(200);
    const rejectedProject = JSON.parse(rejectRes.body);
    expect(rejectedProject.status).toBe("rejected");
  });
});
