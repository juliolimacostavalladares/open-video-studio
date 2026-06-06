/**
 * Rota de recomposição de cenas — POST /projects/:id/scenes/recompose
 *
 * Parseia o rawScript do projeto e reconstrói a lista de cenas no banco.
 * Garante idempotência: pode ser chamado múltiplas vezes com o mesmo resultado.
 */

import type { FastifyInstance } from "fastify";

import { prisma } from "@repo/database";
import { parseScenes } from "@repo/database";

interface RecomposeResponse {
  projectId: string;
  scenesCreated: number;
  scenesDeleted: number;
  scenes: Array<{
    id: string;
    sceneNumber: number;
    title: string;
    orderIndex: number;
    script: string;
  }>;
}

export async function scenesRoutes(app: FastifyInstance): Promise<void> {
  /**
   * POST /projects/:id/scenes/recompose
   *
   * Parseia rawScript do projeto e recompõe as cenas no banco.
   * Idempotente: deletar e recriar mantém resultado consistente.
   */
  app.post<{ Params: { id: string } }>(
    "/projects/:id/scenes/recompose",
    async (request, reply) => {
      const { id } = request.params;

      const project = await prisma.project.findUnique({
        where: { id },
        select: { id: true, rawScript: true, status: true }
      });

      if (!project) {
        return reply.status(404).send({ error: "NOT_FOUND", message: "Projeto não encontrado" });
      }

      if (!project.rawScript || !project.rawScript.trim()) {
        return reply.status(422).send({
          error: "UNPROCESSABLE",
          message: "Projeto não possui rawScript para parsear"
        });
      }

      const parsedScenes = parseScenes(project.rawScript);

      // Recomposição idempotente: deleta cenas existentes e recria
      const [deletedResult] = await prisma.$transaction([
        prisma.scene.deleteMany({
          where: { projectId: id }
        }),
        ...parsedScenes.map((scene) =>
          prisma.scene.create({
            data: {
              projectId: id,
              orderIndex: scene.orderIndex,
              title: scene.title,
              script: scene.script,
              status: "draft"
            }
          })
        )
      ]);

      // Busca as cenas recém-criadas para retornar
      const createdScenes = await prisma.scene.findMany({
        where: { projectId: id },
        orderBy: { orderIndex: "asc" },
        select: {
          id: true,
          orderIndex: true,
          title: true,
          script: true
        }
      });

      const response: RecomposeResponse = {
        projectId: id,
        scenesCreated: parsedScenes.length,
        scenesDeleted: deletedResult.count,
        scenes: createdScenes.map((scene, idx) => ({
          id: scene.id,
          sceneNumber: parsedScenes[idx]?.sceneNumber ?? idx + 1,
          title: scene.title,
          orderIndex: scene.orderIndex,
          script: scene.script
        }))
      };

      return reply.status(200).send(response);
    }
  );

  /**
   * GET /projects/:id/scenes
   *
   * Lista as cenas de um projeto em ordem.
   */
  app.get<{ Params: { id: string } }>("/projects/:id/scenes", async (request, reply) => {
    const { id } = request.params;

    const project = await prisma.project.findUnique({
      where: { id },
      select: { id: true }
    });

    if (!project) {
      return reply.status(404).send({ error: "NOT_FOUND", message: "Projeto não encontrado" });
    }

    const scenes = await prisma.scene.findMany({
      where: { projectId: id },
      orderBy: { orderIndex: "asc" },
      select: {
        id: true,
        orderIndex: true,
        title: true,
        script: true,
        status: true,
        createdAt: true,
        updatedAt: true
      }
    });

    return reply.status(200).send({ projectId: id, scenes });
  });
}
