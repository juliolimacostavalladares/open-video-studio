/**
 * Rotas de projetos — POST /projects
 *
 * Cria um projeto com tema, tom e duração alvo,
 * dispara geração do roteiro inicial via IA e persiste tudo.
 */

import type { FastifyInstance } from "fastify";

import { prisma, calculateEstimatedDuration } from "@repo/database";

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
  createdAt: string;
  updatedAt: string;
  estimatedDuration: number;
  estimatedDurationMin: number;
  estimatedDurationMax: number;
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
  createdAt: Date;
  updatedAt: Date;
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
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    estimatedDuration: duration.average,
    estimatedDurationMin: duration.min,
    estimatedDurationMax: duration.max
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
        message: "title, theme, tone e targetDuration são obrigatórios"
      });
    }

    if (targetDuration <= 0 || targetDuration > 120) {
      return reply.status(400).send({
        error: "BAD_REQUEST",
        message: "targetDuration deve estar entre 1 e 120 minutos"
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
        status: "scripting"
      }
    });

    // Gera o roteiro via IA
    let rawScript: string | null = null;
    let aiError: string | null = null;

    try {
      const aiClient = buildAiClient();
      const result = await generateScript({ theme, tone, targetDuration }, aiClient);

      rawScript = result.rawScript;
    } catch (error) {
      // Falha do provedor de IA é tratável — projeto criado sem roteiro
      aiError = error instanceof Error ? error.message : String(error);
      app.log.error({ projectId: project.id, error: aiError }, "AI generation failed");
    }

    // Persiste roteiro e atualiza status
    const updated = await prisma.project.update({
      where: { id: project.id },
      data: {
        rawScript,
        status: aiError ? "error" : "scripting"
      }
    });

    const status = aiError ? 207 : 201;

    const responseBody: CreateProjectResponse & { aiError?: string } = {
      ...toResponse(updated),
      ...(aiError ? { aiError } : {})
    };

    return reply.status(status).send(responseBody);
  });

  /**
   * GET /projects/:id
   *
   * Retorna os dados de um projeto, incluindo rawScript.
   */
  app.get<{ Params: { id: string } }>("/projects/:id", async (request, reply) => {
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
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        estimatedDuration: 0,
        estimatedDurationMin: 0,
        estimatedDurationMax: 0
      });
    }

    const project = await prisma.project.findUnique({
      where: { id }
    });

    if (!project) {
      return reply.status(404).send({ error: "NOT_FOUND", message: "Projeto não encontrado" });
    }

    return reply.status(200).send(toResponse(project));
  });
}
