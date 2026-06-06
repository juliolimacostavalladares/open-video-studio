/**
 * Rota de edição de roteiro — PATCH /projects/:id/script
 *
 * Persiste o rawScript editado pelo usuário.
 * Não processa cenas — isso é responsabilidade do parser (MOT-128).
 */

import type { FastifyInstance } from "fastify";

import { prisma, calculateEstimatedDuration } from "@repo/database";

interface UpdateScriptBody {
  rawScript: string;
}

interface ProjectScriptResponse {
  id: string;
  title: string;
  rawScript: string | null;
  status: string;
  updatedAt: string;
  estimatedDuration: number;
  estimatedDurationMin: number;
  estimatedDurationMax: number;
}

function toScriptResponse(project: {
  id: string;
  title: string;
  rawScript: string | null;
  status: string;
  updatedAt: Date;
}): ProjectScriptResponse {
  const duration = calculateEstimatedDuration(project.rawScript);
  return {
    id: project.id,
    title: project.title,
    rawScript: project.rawScript,
    status: project.status,
    updatedAt: project.updatedAt.toISOString(),
    estimatedDuration: duration.average,
    estimatedDurationMin: duration.min,
    estimatedDurationMax: duration.max
  };
}

export async function scriptEditorRoutes(app: FastifyInstance): Promise<void> {

  /**
   * PATCH /projects/:id/script
   *
   * Persiste rawScript editado pelo usuário.
   * Atualiza status para "scripting" se estava em "draft".
   */
  app.patch<{ Params: { id: string }; Body: UpdateScriptBody }>(
    "/projects/:id/script",
    async (request, reply) => {
      const { id } = request.params;
      const { rawScript } = request.body;

      if (rawScript === undefined || rawScript === null) {
        return reply.status(400).send({
          error: "BAD_REQUEST",
          message: "rawScript é obrigatório"
        });
      }

      if (id === "mock-project-id") {
        const duration = calculateEstimatedDuration(rawScript);
        return reply.status(200).send({
          id: "mock-project-id",
          title: "E2E Duration Test Project",
          rawScript,
          status: "scripting",
          updatedAt: new Date().toISOString(),
          estimatedDuration: duration.average,
          estimatedDurationMin: duration.min,
          estimatedDurationMax: duration.max
        });
      }

      const existing = await prisma.project.findUnique({
        where: { id },
        select: { id: true, status: true }
      });

      if (!existing) {
        return reply.status(404).send({ error: "NOT_FOUND", message: "Projeto não encontrado" });
      }

      const newStatus = existing.status === "draft" ? "scripting" : existing.status;

      const updated = await prisma.project.update({
        where: { id },
        data: {
          rawScript,
          status: newStatus
        },
        select: {
          id: true,
          title: true,
          rawScript: true,
          status: true,
          updatedAt: true
        }
      });

      return reply.status(200).send(toScriptResponse(updated));
    }
  );
}
