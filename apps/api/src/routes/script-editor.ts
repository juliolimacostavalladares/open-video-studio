/**
 * Rota de edição de roteiro — PATCH /projects/:id/script
 *
 * Persiste o rawScript editado pelo usuário.
 * Não processa cenas — isso é responsabilidade do parser (MOT-128).
 */

import type { FastifyInstance } from "fastify";

import { prisma } from "@repo/database";

interface UpdateScriptBody {
  rawScript: string;
}

interface ProjectScriptResponse {
  id: string;
  title: string;
  rawScript: string | null;
  status: string;
  updatedAt: string;
}

function toScriptResponse(project: {
  id: string;
  title: string;
  rawScript: string | null;
  status: string;
  updatedAt: Date;
}): ProjectScriptResponse {
  return {
    id: project.id,
    title: project.title,
    rawScript: project.rawScript,
    status: project.status,
    updatedAt: project.updatedAt.toISOString()
  };
}

export async function scriptEditorRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /projects/:id
   *
   * Retorna projeto com rawScript para o editor.
   */
  app.get<{ Params: { id: string } }>("/projects/:id", async (request, reply) => {
    const { id } = request.params;

    const project = await prisma.project.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        rawScript: true,
        status: true,
        updatedAt: true
      }
    });

    if (!project) {
      return reply.status(404).send({ error: "NOT_FOUND", message: "Projeto não encontrado" });
    }

    return reply.status(200).send(toScriptResponse(project));
  });

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
