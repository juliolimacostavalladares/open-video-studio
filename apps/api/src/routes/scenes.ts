import type { FastifyInstance } from "fastify";

import {
  buildSceneAudioHash,
  generateSceneKeywords,
  getSceneFallbackAsset,
  parseScenes,
  prisma,
  sceneHasValidAudio,
  sceneNeedsAudioGeneration,
  DEFAULT_FALLBACK_PATH,
} from "@repo/database";
import {
  OmniVoiceStudioTTSBackend,
  createStorageService,
  MockAssetProvider,
  type SuggestedAsset,
} from "@repo/infrastructure";

import { createVoiceSampleFile } from "./audio-support.js";
import { validateAsset } from "../assets/validation.js";

interface SceneListItem {
  id: string;
  title: string;
  orderIndex: number;
  script: string;
  keywords: string[];
  status: string;
  createdAt: Date;
  updatedAt: Date;
  audioContentHash: string | null;
  audioDurationSeconds: number | null;
  audioGeneratedAt: Date | null;
  audioMimeType: string | null;
  audioPath: string | null;
  voiceProfileId: string | null;
  assetId: string | null;
  asset: {
    id: string;
    kind: string;
    path: string;
    source: string;
    status: string;
  } | null;
}

interface RecomposeResponse {
  projectId: string;
  scenesCreated: number;
  scenesDeleted: number;
  scenesUpdated: number;
  scenes: Array<{
    id: string;
    sceneNumber: number;
    title: string;
    orderIndex: number;
    script: string;
  }>;
}

interface SceneSyncResult {
  parsedScenes: ReturnType<typeof parseScenes>;
  projectId: string;
  scenesCreated: number;
  scenesDeleted: number;
  scenesUpdated: number;
  scenes: SceneListItem[];
}

const sceneListSelect = {
  audioContentHash: true,
  audioDurationSeconds: true,
  audioGeneratedAt: true,
  audioMimeType: true,
  audioPath: true,
  createdAt: true,
  id: true,
  keywords: true,
  orderIndex: true,
  script: true,
  status: true,
  title: true,
  updatedAt: true,
  voiceProfileId: true,
  assetId: true,
  asset: {
    select: {
      id: true,
      kind: true,
      path: true,
      source: true,
      status: true,
    },
  },
} as const;

function invalidateSceneAudio() {
  return {
    audioContentHash: null,
    audioDurationSeconds: null,
    audioGeneratedAt: null,
    audioMimeType: null,
    audioPath: null,
    status: "draft" as const,
    voiceProfileId: null,
  };
}

function toSceneResponse(
  scene: SceneListItem,
  selectedVoiceProfileId: string | null,
) {
  return {
    audioContentHash: scene.audioContentHash,
    audioDurationSeconds: scene.audioDurationSeconds,
    audioGeneratedAt: scene.audioGeneratedAt,
    audioMimeType: scene.audioMimeType,
    audioPath: scene.audioPath,
    createdAt: scene.createdAt,
    hasValidAudio: sceneHasValidAudio({
      audioContentHash: scene.audioContentHash,
      audioPath: scene.audioPath,
      script: scene.script,
      voiceProfileId: selectedVoiceProfileId,
    }),
    id: scene.id,
    keywords: scene.keywords,
    orderIndex: scene.orderIndex,
    script: scene.script,
    status: scene.status,
    title: scene.title,
    updatedAt: scene.updatedAt,
    voiceProfileId: scene.voiceProfileId,
    assetId: scene.assetId,
    asset: scene.asset
      ? {
          id: scene.asset.id,
          kind: scene.asset.kind,
          path: scene.asset.path,
          source: scene.asset.source,
          status: scene.asset.status,
        }
      : null,
  };
}

async function listProjectScenes(projectId: string) {
  return prisma.scene.findMany({
    where: { projectId },
    orderBy: { orderIndex: "asc" },
    select: sceneListSelect,
  }) as Promise<SceneListItem[]>;
}

export async function syncProjectScenesFromRawScript(
  projectId: string,
  rawScript: string,
): Promise<SceneSyncResult> {
  const parsedScenes = parseScenes(rawScript);
  const nextOrderIndexes = new Set(
    parsedScenes.map((scene) => scene.orderIndex),
  );

  let scenesCreated = 0;
  let scenesUpdated = 0;
  let scenesDeleted = 0;

  await prisma.$transaction(async (tx) => {
    const existingScenes = (await tx.scene.findMany({
      where: { projectId },
      orderBy: { orderIndex: "asc" },
      select: sceneListSelect,
    })) as SceneListItem[];

    const existingByOrder = new Map(
      existingScenes.map((scene) => [scene.orderIndex, scene]),
    );
    const scenesToCreate = parsedScenes.filter(
      (scene) => !existingByOrder.has(scene.orderIndex),
    );

    if (scenesToCreate.length > 0) {
      const result = await tx.scene.createMany({
        data: scenesToCreate.map((parsedScene) => ({
          keywords: generateSceneKeywords({
            script: parsedScene.script,
            title: parsedScene.title,
          }),
          orderIndex: parsedScene.orderIndex,
          projectId,
          script: parsedScene.script,
          status: "draft",
          title: parsedScene.title,
        })),
        skipDuplicates: true,
      });

      scenesCreated = result.count;
    }

    for (const parsedScene of parsedScenes) {
      const existing = existingByOrder.get(parsedScene.orderIndex);

      if (!existing) {
        continue;
      }

      const contentChanged =
        existing.title !== parsedScene.title ||
        existing.script !== parsedScene.script;

      if (!contentChanged) {
        continue;
      }

      scenesUpdated += 1;
      await tx.scene.update({
        where: { id: existing.id },
        data: {
          ...invalidateSceneAudio(),
          keywords: generateSceneKeywords({
            script: parsedScene.script,
            title: parsedScene.title,
          }),
          script: parsedScene.script,
          title: parsedScene.title,
        },
      });
    }

    const idsToDelete = existingScenes
      .filter((scene) => !nextOrderIndexes.has(scene.orderIndex))
      .map((scene) => scene.id);

    if (idsToDelete.length > 0) {
      const result = await tx.scene.deleteMany({
        where: {
          id: {
            in: idsToDelete,
          },
        },
      });
      scenesDeleted = result.count;
    }
  });

  const scenes = await listProjectScenes(projectId);

  return {
    parsedScenes,
    projectId,
    scenes,
    scenesCreated,
    scenesDeleted,
    scenesUpdated,
  };
}

export async function scenesRoutes(app: FastifyInstance): Promise<void> {
  const ttsBackend = new OmniVoiceStudioTTSBackend();
  const storage = createStorageService();

  app.post<{ Params: { id: string } }>(
    "/projects/:id/scenes/recompose",
    async (request, reply) => {
      const { id } = request.params;

      const project = await prisma.project.findUnique({
        where: { id },
        select: { id: true, rawScript: true },
      });

      if (!project) {
        return reply
          .status(404)
          .send({ error: "NOT_FOUND", message: "Projeto não encontrado" });
      }

      if (!project.rawScript || !project.rawScript.trim()) {
        return reply.status(422).send({
          error: "UNPROCESSABLE",
          message: "Projeto não possui rawScript para parsear",
        });
      }

      const result = await syncProjectScenesFromRawScript(
        id,
        project.rawScript,
      );

      return reply.status(200).send({
        projectId: id,
        scenesCreated: result.scenesCreated,
        scenesDeleted: result.scenesDeleted,
        scenesUpdated: result.scenesUpdated,
        scenes: result.scenes.map((scene, idx) => ({
          id: scene.id,
          orderIndex: scene.orderIndex,
          sceneNumber: result.parsedScenes[idx]?.sceneNumber ?? idx + 1,
          script: scene.script,
          title: scene.title,
        })),
      } satisfies RecomposeResponse);
    },
  );

  app.get<{ Params: { id: string } }>(
    "/projects/:id/scenes",
    async (request, reply) => {
      const { id } = request.params;

      const project = await prisma.project.findUnique({
        where: { id },
        select: { id: true, voiceProfileId: true, rawScript: true },
      });

      if (!project) {
        return reply
          .status(404)
          .send({ error: "NOT_FOUND", message: "Projeto não encontrado" });
      }

      let scenes = await listProjectScenes(id);

      // --- Self-healing: if no scenes exist in DB but script is present, sync them on-the-fly ---
      if (scenes.length === 0 && project.rawScript && project.rawScript.trim()) {
        app.log.info({ projectId: id }, "Self-healing: No scenes found in DB, parsing and syncing from rawScript");
        await syncProjectScenesFromRawScript(id, project.rawScript);
        scenes = await listProjectScenes(id);
      }

      // --- Fallback logic ---
      const scenesWithoutAsset = scenes.filter((scene) => !scene.assetId);
      if (scenesWithoutAsset.length > 0) {
        let fallbackAsset = await prisma.asset.findFirst({
          where: {
            projectId: id,
            path: DEFAULT_FALLBACK_PATH,
          },
        });

        if (!fallbackAsset) {
          fallbackAsset = await prisma.asset.create({
            data: getSceneFallbackAsset(id),
          });
        }

        await prisma.$transaction(
          scenesWithoutAsset.map((scene) =>
            prisma.scene.update({
              where: { id: scene.id },
              data: { assetId: fallbackAsset!.id },
            }),
          ),
        );

        scenes = await listProjectScenes(id);
      }
      // ----------------------

      const assetProvider = new MockAssetProvider();

      const scenesWithSuggestions = await Promise.all(
        scenes.map(async (scene) => {
          let suggestedAssets: SuggestedAsset[] = [];
          try {
            suggestedAssets = await assetProvider.search(scene.keywords);
          } catch (error) {
            app.log.error(
              error,
              `Erro ao buscar assets para a cena ${scene.id}`,
            );
          }

          return {
            ...toSceneResponse(scene, project.voiceProfileId),
            suggestedAssets,
          };
        }),
      );

      return reply.status(200).send({
        projectId: id,
        scenes: scenesWithSuggestions,
      });
    },
  );

  app.post<{ Params: { id: string; sceneId: string } }>(
    "/projects/:id/scenes/:sceneId/asset",
    async (request, reply) => {
      const { id: projectId, sceneId } = request.params;

      const scene = await prisma.scene.findUnique({
        where: { id: sceneId, projectId },
        select: { id: true },
      });

      if (!scene) {
        return reply
          .status(404)
          .send({ error: "NOT_FOUND", message: "Cena não encontrada" });
      }

      let fileName = "";
      let mimeType = "";
      let assetBuffer: Buffer | null = null;

      for await (const part of request.parts()) {
        if (part.type === "file" && part.fieldname === "asset") {
          fileName = part.filename;
          mimeType = part.mimetype;
          assetBuffer = await part.toBuffer();
        }
      }

      if (!assetBuffer) {
        return reply.status(400).send({
          error: "BAD_REQUEST",
          message: "O arquivo do asset é obrigatório",
        });
      }

      try {
        const metadata = validateAsset({
          buffer: assetBuffer,
          fileName,
          mimeType,
        });

        await prisma.$transaction(async (tx) => {
          const createdAsset = await tx.asset.create({
            data: {
              projectId,
              kind: metadata.kind,
              source: "upload",
              path: "",
              status: "ready",
            },
          });

          const extension = fileName
            .toLowerCase()
            .slice(fileName.lastIndexOf("."));
          const storageKey = `manual/${createdAsset.id}${extension}`;

          await storage.putObject(
            "assets",
            storageKey,
            assetBuffer!,
            metadata.mimeType,
          );

          await tx.asset.update({
            where: { id: createdAsset.id },
            data: {
              path: `assets/${storageKey}`,
            },
          });

          return tx.scene.update({
            where: { id: sceneId },
            data: {
              assetId: createdAsset.id,
            },
          });
        });

        const project = await prisma.project.findUnique({
          where: { id: projectId },
          select: { voiceProfileId: true },
        });

        const fullSceneListItem = await prisma.scene.findUnique({
          where: { id: sceneId },
          select: {
            audioContentHash: true,
            audioDurationSeconds: true,
            audioGeneratedAt: true,
            audioMimeType: true,
            audioPath: true,
            createdAt: true,
            id: true,
            keywords: true,
            orderIndex: true,
            script: true,
            status: true,
            title: true,
            updatedAt: true,
            voiceProfileId: true,
            assetId: true,
            asset: {
              select: {
                id: true,
                kind: true,
                path: true,
                source: true,
                status: true,
              },
            },
          },
        });

        if (!fullSceneListItem) {
          throw new Error(
            "Erro inesperado ao buscar dados atualizados da cena",
          );
        }

        return reply
          .status(200)
          .send(
            toSceneResponse(fullSceneListItem, project?.voiceProfileId ?? null),
          );
      } catch (error) {
        return reply.status(400).send({
          error: "BAD_REQUEST",
          message:
            error instanceof Error
              ? error.message
              : "O arquivo enviado é inválido",
        });
      }
    },
  );

  app.post<{ Params: { id: string } }>(
    "/projects/:id/scenes/audio/generate",
    async (request, reply) => {
      const { id } = request.params;

      const project = await prisma.project.findUnique({
        where: { id },
        select: {
          id: true,
          scenes: {
            orderBy: { orderIndex: "asc" },
            select: {
              audioContentHash: true,
              audioPath: true,
              id: true,
              orderIndex: true,
              script: true,
              title: true,
              voiceProfileId: true,
            },
          },
          voiceProfile: {
            select: {
              id: true,
              provider: true,
              samplePath: true,
            },
          },
          voiceProfileId: true,
        },
      });

      if (!project) {
        return reply
          .status(404)
          .send({ error: "NOT_FOUND", message: "Projeto não encontrado" });
      }

      if (!project.voiceProfileId || !project.voiceProfile) {
        return reply.status(422).send({
          error: "UNPROCESSABLE",
          message: "Selecione uma voz antes de gerar áudio por cena",
        });
      }

      if (project.scenes.length === 0) {
        return reply.status(422).send({
          error: "UNPROCESSABLE",
          message: "Projeto não possui cenas para gerar áudio",
        });
      }
      const { cleanup, tempSamplePath } = await createVoiceSampleFile(
        project.voiceProfile.samplePath,
        `${project.voiceProfile.id}.wav`,
      );

      try {
        const pendingScenes = project.scenes.filter((scene) =>
          sceneNeedsAudioGeneration({
            audioContentHash: scene.audioContentHash,
            audioPath: scene.audioPath,
            currentVoiceProfileId: project.voiceProfileId,
            generatedVoiceProfileId: scene.voiceProfileId,
            script: scene.script,
            voiceProfileId: scene.voiceProfileId,
          }),
        );

        const jobs = [];

        for (const scene of pendingScenes) {
          const audioContentHash = buildSceneAudioHash({
            script: scene.script,
            voiceProfileId: project.voiceProfileId,
          });
          const artifact = await ttsBackend.synthesize({
            text: scene.script,
            voiceProfile: {
              id: project.voiceProfile.id,
              provider: project.voiceProfile.provider,
              samplePath: tempSamplePath,
            },
          });
          const storageKey = `scenes/${project.id}/${scene.id}-${audioContentHash}.wav`;

          await storage.putObject(
            "audio",
            storageKey,
            artifact.audio,
            artifact.contentType,
          );
          await prisma.scene.update({
            where: { id: scene.id },
            data: {
              audioContentHash,
              audioDurationSeconds: artifact.audioDurationSeconds ?? null,
              audioGeneratedAt: artifact.generatedAt,
              audioMimeType: artifact.contentType,
              audioPath: `audio/${storageKey}`,
              status: "ready",
              voiceProfileId: project.voiceProfileId,
            },
          });

          jobs.push({
            audioPath: `audio/${storageKey}`,
            jobKey: `${project.id}:${scene.id}:${audioContentHash}`,
            orderIndex: scene.orderIndex,
            sceneId: scene.id,
            title: scene.title,
          });
        }

        const updatedScenes = await listProjectScenes(project.id);

        return reply.status(200).send({
          generatedCount: jobs.length,
          jobs,
          projectId: project.id,
          scenes: updatedScenes.map((scene) =>
            toSceneResponse(scene, project.voiceProfileId),
          ),
          skippedCount: project.scenes.length - jobs.length,
        });
      } finally {
        await cleanup();
      }
    },
  );
}
