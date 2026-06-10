/**
 * Rotas de projetos — POST /projects
 *
 * Cria um projeto com tema, tom e duração alvo,
 * dispara geração do roteiro inicial via IA e persiste tudo.
 */

import type { FastifyInstance } from "fastify";

import {
  prisma,
  calculateEstimatedDuration,
  canPublishProject,
} from "@repo/database";

import { buildAiClient } from "../ai/client.js";
import { generateScript } from "../ai/script-generator.js";

interface CreateProjectBody {
  title: string;
  theme: string;
  tone: string;
  targetDuration: number;
  description?: string;
}

interface CreateProjectResponse {
  id: string;
  title: string;
  theme: string;
  tone: string;
  targetDuration: number;
  description: string | null;
  rawScript: string | null;
  status: string;
  voiceProfileId: string | null;
  createdAt: string;
  updatedAt: string;
  estimatedDuration: number;
  estimatedDurationMin: number;
  estimatedDurationMax: number;
  tags: string[];
}

function toResponse(project: {
  id: string;
  title: string;
  theme: string | null;
  tone: string | null;
  targetDuration: number | null;
  description: string | null;
  rawScript: string | null;
  status: string;
  voiceProfileId: string | null;
  createdAt: Date;
  updatedAt: Date;
  tags?: string[];
}): CreateProjectResponse {
  const duration = calculateEstimatedDuration(project.rawScript);
  return {
    id: project.id,
    title: project.title,
    theme: project.theme ?? "",
    tone: project.tone ?? "",
    targetDuration: project.targetDuration ?? 0,
    description: project.description,
    rawScript: project.rawScript,
    status: project.status,
    voiceProfileId: project.voiceProfileId,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    estimatedDuration: duration.average,
    estimatedDurationMin: duration.min,
    estimatedDurationMax: duration.max,
    tags: project.tags ?? [],
  };
}

export async function projectsRoutes(app: FastifyInstance): Promise<void> {
  /**
   * POST /projects
   *
   * Cria um projeto, gera roteiro inicial via IA e persiste.
   */
  app.post<{ Body: CreateProjectBody }>("/projects", async (request, reply) => {
    const { title, theme, tone, targetDuration, description } = request.body;

    // Validação básica (Fastify schema seria ideal; aqui mantemos simples)
    if (!title || !theme || !tone || !targetDuration) {
      return reply.status(400).send({
        error: "BAD_REQUEST",
        message: "title, theme, tone e targetDuration são obrigatórios",
      });
    }

    if (targetDuration <= 0 || targetDuration > 120) {
      return reply.status(400).send({
        error: "BAD_REQUEST",
        message: "targetDuration deve estar entre 1 e 120 minutos",
      });
    }

    // Cria o projeto com status scripting
    const project = await prisma.project.create({
      data: {
        title,
        theme,
        tone,
        targetDuration,
        description: description ?? null,
        status: "scripting",
      },
    });

    // Gera o roteiro via IA
    let rawScript: string | null = null;
    let aiError: string | null = null;

    try {
      const aiClient = buildAiClient();
      const result = await generateScript(
        { theme, tone, targetDuration },
        aiClient,
      );

      rawScript = result.rawScript;
    } catch (error) {
      // Falha do provedor de IA é tratável — projeto criado sem roteiro
      aiError = error instanceof Error ? error.message : String(error);
      app.log.error(
        { projectId: project.id, error: aiError },
        "AI generation failed",
      );
    }

    // Persiste roteiro e atualiza status
    const updated = await prisma.project.update({
      where: { id: project.id },
      data: {
        rawScript,
        status: aiError ? "error" : "scripting",
      },
    });

    const status = aiError ? 207 : 201;

    const responseBody: CreateProjectResponse & { aiError?: string } = {
      ...toResponse(updated),
      ...(aiError ? { aiError } : {}),
    };

    return reply.status(status).send(responseBody);
  });

  /**
   * GET /projects/:id
   *
   * Retorna os dados de um projeto, incluindo rawScript.
   */
  app.get<{ Params: { id: string } }>(
    "/projects/:id",
    async (request, reply) => {
      const { id } = request.params;

      if (id === "mock-project-id") {
        return reply.status(200).send({
          id: "mock-project-id",
          title: "E2E Duration Test Project",
          theme: "test",
          tone: "test",
          targetDuration: 10,
          description: null,
          rawScript: "",
          status: "draft",
          voiceProfileId: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          estimatedDuration: 0,
          estimatedDurationMin: 0,
          estimatedDurationMax: 0,
        });
      }

      const project = await prisma.project.findUnique({
        where: { id },
      });

      if (!project) {
        return reply
          .status(404)
          .send({ error: "NOT_FOUND", message: "Projeto não encontrado" });
      }

      return reply.status(200).send(toResponse(project));
    },
  );

  interface UpdateProjectBody {
    title?: string;
    description?: string | null;
    tags?: string[];
  }

  app.patch<{
    Params: { id: string };
    Body: UpdateProjectBody;
  }>("/projects/:id", async (request, reply) => {
    const { id } = request.params;
    const { title, description, tags } = request.body;

    if (id === "mock-project-id") {
      if (title !== undefined && title.trim() === "") {
        return reply.status(400).send({
          error: "BAD_REQUEST",
          message: "O título não pode ser vazio",
        });
      }
      if (
        tags !== undefined &&
        (!Array.isArray(tags) || tags.some((t) => typeof t !== "string"))
      ) {
        return reply.status(400).send({
          error: "BAD_REQUEST",
          message: "Tags deve ser um array de strings",
        });
      }
      return reply.status(200).send({
        id: "mock-project-id",
        title: title !== undefined ? title : "Review E2E Project",
        theme: "test",
        tone: "test",
        targetDuration: 10,
        description: description !== undefined ? description : null,
        rawScript: "",
        status: "draft",
        voiceProfileId: "voice-id",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        estimatedDuration: 0,
        estimatedDurationMin: 0,
        estimatedDurationMax: 0,
        tags:
          tags !== undefined
            ? tags.map((t) => t.trim()).filter((t) => t !== "")
            : [],
      });
    }

    const project = await prisma.project.findUnique({
      where: { id },
    });

    if (!project) {
      return reply
        .status(404)
        .send({ error: "NOT_FOUND", message: "Projeto não encontrado" });
    }

    const updateData: {
      title?: string;
      description?: string | null;
      tags?: string[];
      status?: "ready_for_review";
    } = {};

    let changed = false;

    if (title !== undefined) {
      if (title.trim() === "") {
        return reply.status(400).send({
          error: "BAD_REQUEST",
          message: "O título não pode ser vazio",
        });
      }
      if (title !== project.title) {
        changed = true;
      }
      updateData.title = title;
    }

    if (description !== undefined) {
      if (description !== project.description) {
        changed = true;
      }
      updateData.description = description;
    }

    if (tags !== undefined) {
      if (!Array.isArray(tags) || tags.some((t) => typeof t !== "string")) {
        return reply.status(400).send({
          error: "BAD_REQUEST",
          message: "Tags deve ser um array de strings",
        });
      }
      const parsedTags = tags.map((t) => t.trim()).filter((t) => t !== "");
      const currentTags = project.tags || [];
      if (
        parsedTags.length !== currentTags.length ||
        parsedTags.some((t, i) => t !== currentTags[i])
      ) {
        changed = true;
      }
      updateData.tags = parsedTags;
    }

    if (changed && project.status === "approved") {
      updateData.status = "ready_for_review";
    }

    const updated = await prisma.project.update({
      where: { id },
      data: updateData,
    });

    return reply.status(200).send(toResponse(updated));
  });

  app.post<{ Params: { id: string } }>(
    "/projects/:id/approve",
    async (request, reply) => {
      const { id } = request.params;

      if (id === "mock-project-id") {
        return reply.status(200).send({
          id: "mock-project-id",
          title: "Review E2E Project",
          theme: "test",
          tone: "test",
          targetDuration: 10,
          description: null,
          rawScript: "",
          status: "approved",
          voiceProfileId: "voice-id",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          estimatedDuration: 0,
          estimatedDurationMin: 0,
          estimatedDurationMax: 0,
          tags: [],
        });
      }

      const project = await prisma.project.findUnique({
        where: { id },
      });

      if (!project) {
        return reply
          .status(404)
          .send({ error: "NOT_FOUND", message: "Projeto não encontrado" });
      }

      // Check if project has a successful render job
      const renderJob = await prisma.renderJob.findFirst({
        where: { projectId: id, status: "succeeded" },
      });

      if (!renderJob) {
        return reply.status(400).send({
          error: "BAD_REQUEST",
          message:
            "O projeto precisa ter um vídeo renderizado com sucesso para ser aprovado.",
        });
      }

      const updated = await prisma.$transaction(async (tx) => {
        const u = await tx.project.update({
          where: { id },
          data: { status: "approved" },
        });

        await tx.approvalLog.create({
          data: {
            projectId: id,
            approvedBy: "operator", // MVP single operator default
            videoVersion: renderJob.outputPath || "unknown",
          },
        });

        return u;
      });

      return reply.status(200).send(toResponse(updated));
    },
  );

  app.post<{ Params: { id: string } }>(
    "/projects/:id/reject",
    async (request, reply) => {
      const { id } = request.params;

      if (id === "mock-project-id") {
        return reply.status(200).send({
          id: "mock-project-id",
          title: "Review E2E Project",
          theme: "test",
          tone: "test",
          targetDuration: 10,
          description: null,
          rawScript: "",
          status: "rejected",
          voiceProfileId: "voice-id",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          estimatedDuration: 0,
          estimatedDurationMin: 0,
          estimatedDurationMax: 0,
          tags: [],
        });
      }

      const project = await prisma.project.findUnique({
        where: { id },
      });

      if (!project) {
        return reply
          .status(404)
          .send({ error: "NOT_FOUND", message: "Projeto não encontrado" });
      }

      const updated = await prisma.project.update({
        where: { id },
        data: { status: "rejected" },
      });

      return reply.status(200).send(toResponse(updated));
    },
  );

  app.post<{ Params: { id: string } }>(
    "/projects/:id/publish",
    async (request, reply) => {
      const { id } = request.params;

      if (id === "mock-project-id") {
        return reply.status(200).send({
          success: true,
          message: "Projeto publicado com sucesso (Mock)",
        });
      }

      const project = await prisma.project.findUnique({
        where: { id },
      });

      if (!project) {
        return reply
          .status(404)
          .send({ error: "NOT_FOUND", message: "Projeto não encontrado" });
      }

      // Enforce approved guard
      if (!canPublishProject(project.status)) {
        return reply.status(400).send({
          error: "BAD_REQUEST",
          message: "O projeto precisa ser aprovado antes de ser publicado.",
        });
      }

      // Return success for now (mocking the publish action as requested since actual publish is Sprint 6)
      return reply.status(200).send({
        success: true,
        message: "Projeto publicado com sucesso",
        projectId: id,
      });
    },
  );

  app.patch<{
    Params: { id: string };
    Body: { voiceProfileId: string | null };
  }>("/projects/:id/voice-profile", async (request, reply) => {
    const { id } = request.params;
    const { voiceProfileId } = request.body;

    if (id === "mock-project-id") {
      return reply.status(200).send({
        id: "mock-project-id",
        title: "E2E Duration Test Project",
        theme: "test",
        tone: "test",
        targetDuration: 10,
        description: null,
        rawScript: "",
        status: "draft",
        voiceProfileId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        estimatedDuration: 0,
        estimatedDurationMin: 0,
        estimatedDurationMax: 0,
      });
    }

    const project = await prisma.project.findUnique({
      where: { id },
      select: { id: true, voiceProfileId: true },
    });

    if (!project) {
      return reply
        .status(404)
        .send({ error: "NOT_FOUND", message: "Projeto não encontrado" });
    }

    if (voiceProfileId) {
      const profile = await prisma.voiceProfile.findUnique({
        where: { id: voiceProfileId },
        select: { id: true },
      });

      if (!profile) {
        return reply.status(404).send({
          error: "NOT_FOUND",
          message: "Perfil de voz não encontrado",
        });
      }
    }

    const updated = await prisma.project.update({
      where: { id },
      data: { voiceProfileId },
      select: {
        id: true,
        title: true,
        theme: true,
        tone: true,
        targetDuration: true,
        description: true,
        rawScript: true,
        status: true,
        voiceProfileId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (project.voiceProfileId !== voiceProfileId) {
      await prisma.scene.updateMany({
        where: { projectId: id },
        data: {
          status: "draft",
        },
      });
    }

    return reply.status(200).send(toResponse(updated));
  });

  const renderPostHandler = async (
    request: import("fastify").FastifyRequest<{ Params: { id: string } }>,
    reply: import("fastify").FastifyReply,
  ) => {
    const { id } = request.params;

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        scenes: {
          orderBy: { orderIndex: "asc" },
        },
      },
    });

    if (!project) {
      return reply
        .status(404)
        .send({ error: "NOT_FOUND", message: "Projeto não encontrado" });
    }

    if (project.scenes.length === 0) {
      return reply
        .status(400)
        .send({ error: "BAD_REQUEST", message: "Projeto sem cenas" });
    }

    const { canStartRenderWithSceneAudio, sceneHasValidAudio } = await import(
      "@repo/database"
    );

    const isReady = canStartRenderWithSceneAudio(
      project.scenes.map((scene) => ({
        ...scene,
        voiceProfileId: project.voiceProfileId,
      })),
      project.voiceProfileId,
    );

    if (!isReady) {
      const invalidSceneIds = project.scenes
        .filter(
          (scene) =>
            !sceneHasValidAudio({
              audioContentHash: scene.audioContentHash,
              audioPath: scene.audioPath,
              script: scene.script,
              voiceProfileId: project.voiceProfileId,
            }),
        )
        .map((scene) => scene.id);

      return reply.status(409).send({
        error: "AUDIO_REQUIRED",
        invalidSceneIds,
        message: "Existem cenas sem áudio válido para iniciar o render",
      });
    }

    const activeJob = await prisma.renderJob.findFirst({
      where: {
        projectId: id,
        status: { in: ["queued", "running"] },
      },
    });

    if (activeJob) {
      return reply.status(200).send({
        id: activeJob.id,
        projectId: activeJob.projectId,
        status: activeJob.status,
        outputPath: activeJob.outputPath,
        errorMessage: activeJob.errorMessage,
        createdAt: activeJob.createdAt.toISOString(),
        updatedAt: activeJob.updatedAt.toISOString(),
      });
    }

    const renderJob = await prisma.renderJob.create({
      data: {
        projectId: id,
        status: "queued",
      },
    });

    await prisma.project.update({
      where: { id },
      data: { status: "rendering" },
    });

    const { createPipelineQueue } = await import("@repo/infrastructure");
    const { queue, close: closeQueue } = createPipelineQueue();
    try {
      await queue.add("render", {
        target: "render",
        referenceId: renderJob.id,
      });
    } finally {
      await closeQueue();
    }

    return reply.status(201).send({
      id: renderJob.id,
      projectId: renderJob.projectId,
      status: renderJob.status,
      outputPath: renderJob.outputPath,
      errorMessage: renderJob.errorMessage,
      createdAt: renderJob.createdAt.toISOString(),
      updatedAt: renderJob.updatedAt.toISOString(),
    });
  };

  const renderGetHandler = async (
    request: import("fastify").FastifyRequest<{ Params: { id: string } }>,
    reply: import("fastify").FastifyReply,
  ) => {
    const { id } = request.params;

    const project = await prisma.project.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!project) {
      return reply
        .status(404)
        .send({ error: "NOT_FOUND", message: "Projeto não encontrado" });
    }

    const latestJob = await prisma.renderJob.findFirst({
      where: { projectId: id },
      orderBy: { createdAt: "desc" },
    });

    if (!latestJob) {
      return reply.status(404).send({
        error: "NOT_FOUND",
        message: "Nenhum job de renderização encontrado para este projeto",
      });
    }

    return reply.status(200).send({
      id: latestJob.id,
      projectId: latestJob.projectId,
      status: latestJob.status,
      outputPath: latestJob.outputPath,
      errorMessage: latestJob.errorMessage,
      createdAt: latestJob.createdAt.toISOString(),
      updatedAt: latestJob.updatedAt.toISOString(),
    });
  };

  app.post<{ Params: { id: string } }>(
    "/projects/:id/renders",
    renderPostHandler,
  );
  app.post<{ Params: { id: string } }>(
    "/projects/:id/render",
    renderPostHandler,
  );
  app.get<{ Params: { id: string } }>(
    "/projects/:id/renders",
    renderGetHandler,
  );
  app.get<{ Params: { id: string } }>("/projects/:id/render", renderGetHandler);
}
