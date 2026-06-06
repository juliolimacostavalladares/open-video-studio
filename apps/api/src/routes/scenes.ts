import type { FastifyInstance } from "fastify";

import {
  buildSceneAudioHash,
  canStartRenderWithSceneAudio,
  generateSceneKeywords,
  parseScenes,
  prisma,
  sceneHasValidAudio,
  sceneNeedsAudioGeneration
} from "@repo/database";
import { OmniVoiceStudioTTSBackend, createStorageService } from "@repo/infrastructure";

import { createVoiceSampleFile } from "./audio-support.js";

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

function invalidateSceneAudio() {
  return {
    audioContentHash: null,
    audioDurationSeconds: null,
    audioGeneratedAt: null,
    audioMimeType: null,
    audioPath: null,
    status: "draft" as const,
    voiceProfileId: null
  };
}

function toSceneResponse(scene: SceneListItem, selectedVoiceProfileId: string | null) {
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
      voiceProfileId: selectedVoiceProfileId
    }),
    id: scene.id,
    keywords: scene.keywords,
    orderIndex: scene.orderIndex,
    script: scene.script,
    status: scene.status,
    title: scene.title,
    updatedAt: scene.updatedAt,
    voiceProfileId: scene.voiceProfileId
  };
}

async function listProjectScenes(projectId: string) {
  return prisma.scene.findMany({
    where: { projectId },
    orderBy: { orderIndex: "asc" },
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
      voiceProfileId: true
    }
  });
}

export async function syncProjectScenesFromRawScript(projectId: string, rawScript: string): Promise<SceneSyncResult> {
  const parsedScenes = parseScenes(rawScript);
  const existingScenes = await listProjectScenes(projectId);
  const existingByOrder = new Map(existingScenes.map((scene) => [scene.orderIndex, scene]));
  const nextOrderIndexes = new Set(parsedScenes.map((scene) => scene.orderIndex));

  let scenesCreated = 0;
  let scenesUpdated = 0;

  await prisma.$transaction(async (tx) => {
    for (const parsedScene of parsedScenes) {
      const existing = existingByOrder.get(parsedScene.orderIndex);

      if (!existing) {
        scenesCreated += 1;
        await tx.scene.create({
          data: {
            keywords: generateSceneKeywords({
              script: parsedScene.script,
              title: parsedScene.title
            }),
            orderIndex: parsedScene.orderIndex,
            projectId,
            script: parsedScene.script,
            status: "draft",
            title: parsedScene.title
          }
        });
        continue;
      }

      const contentChanged = existing.title !== parsedScene.title || existing.script !== parsedScene.script;

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
            title: parsedScene.title
          }),
          script: parsedScene.script,
          title: parsedScene.title
        }
      });
    }

    const idsToDelete = existingScenes
      .filter((scene) => !nextOrderIndexes.has(scene.orderIndex))
      .map((scene) => scene.id);

    if (idsToDelete.length > 0) {
      await tx.scene.deleteMany({
        where: {
          id: {
            in: idsToDelete
          }
        }
      });
    }
  });

  const scenes = await listProjectScenes(projectId);
  const scenesDeleted = existingScenes.filter((scene) => !nextOrderIndexes.has(scene.orderIndex)).length;

  return {
    parsedScenes,
    projectId,
    scenes,
    scenesCreated,
    scenesDeleted,
    scenesUpdated
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
        select: { id: true, rawScript: true }
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

      const result = await syncProjectScenesFromRawScript(id, project.rawScript);

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
          title: scene.title
        }))
      } satisfies RecomposeResponse);
    }
  );

  app.get<{ Params: { id: string } }>("/projects/:id/scenes", async (request, reply) => {
    const { id } = request.params;

    const project = await prisma.project.findUnique({
      where: { id },
      select: { id: true, voiceProfileId: true }
    });

    if (!project) {
      return reply.status(404).send({ error: "NOT_FOUND", message: "Projeto não encontrado" });
    }

    const scenes = await listProjectScenes(id);

    return reply.status(200).send({
      projectId: id,
      scenes: scenes.map((scene) => toSceneResponse(scene, project.voiceProfileId))
    });
  });

  app.post<{ Params: { id: string } }>("/projects/:id/scenes/audio/generate", async (request, reply) => {
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
            voiceProfileId: true
          }
        },
        voiceProfile: {
          select: {
            id: true,
            provider: true,
            samplePath: true
          }
        },
        voiceProfileId: true
      }
    });

    if (!project) {
      return reply.status(404).send({ error: "NOT_FOUND", message: "Projeto não encontrado" });
    }

    if (!project.voiceProfileId || !project.voiceProfile) {
      return reply.status(422).send({
        error: "UNPROCESSABLE",
        message: "Selecione uma voz antes de gerar áudio por cena"
      });
    }

    if (project.scenes.length === 0) {
      return reply.status(422).send({
        error: "UNPROCESSABLE",
        message: "Projeto não possui cenas para gerar áudio"
      });
    }

    const { cleanup, tempSamplePath } = await createVoiceSampleFile(
      project.voiceProfile.samplePath,
      `${project.voiceProfile.id}.wav`
    );

    try {
      const pendingScenes = project.scenes.filter((scene) =>
        sceneNeedsAudioGeneration({
          audioContentHash: scene.audioContentHash,
          audioPath: scene.audioPath,
          currentVoiceProfileId: project.voiceProfileId,
          generatedVoiceProfileId: scene.voiceProfileId,
          script: scene.script,
          voiceProfileId: scene.voiceProfileId
        })
      );

      const jobs = [];

      for (const scene of pendingScenes) {
        const audioContentHash = buildSceneAudioHash({
          script: scene.script,
          voiceProfileId: project.voiceProfileId
        });
        const artifact = await ttsBackend.synthesize({
          text: scene.script,
          voiceProfile: {
            id: project.voiceProfile.id,
            provider: project.voiceProfile.provider,
            samplePath: tempSamplePath
          }
        });
        const storageKey = `scenes/${project.id}/${scene.id}-${audioContentHash}.wav`;

        await storage.putObject("audio", storageKey, artifact.audio, artifact.contentType);
        await prisma.scene.update({
          where: { id: scene.id },
          data: {
            audioContentHash,
            audioDurationSeconds: artifact.audioDurationSeconds ?? null,
            audioGeneratedAt: artifact.generatedAt,
            audioMimeType: artifact.contentType,
            audioPath: `audio/${storageKey}`,
            status: "ready",
            voiceProfileId: project.voiceProfileId
          }
        });

        jobs.push({
          audioPath: `audio/${storageKey}`,
          jobKey: `${project.id}:${scene.id}:${audioContentHash}`,
          orderIndex: scene.orderIndex,
          sceneId: scene.id,
          title: scene.title
        });
      }

      const updatedScenes = await listProjectScenes(project.id);

      return reply.status(200).send({
        generatedCount: jobs.length,
        jobs,
        projectId: project.id,
        scenes: updatedScenes.map((scene) => toSceneResponse(scene, project.voiceProfileId)),
        skippedCount: project.scenes.length - jobs.length
      });
    } finally {
      await cleanup();
    }
  });

  app.post<{ Params: { id: string } }>("/projects/:id/renders", async (request, reply) => {
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
            script: true
          }
        },
        voiceProfileId: true
      }
    });

    if (!project) {
      return reply.status(404).send({ error: "NOT_FOUND", message: "Projeto não encontrado" });
    }

    const isReady = canStartRenderWithSceneAudio(
      project.scenes.map((scene) => ({
        ...scene,
        voiceProfileId: project.voiceProfileId
      })),
      project.voiceProfileId
    );

    if (!isReady) {
      const invalidSceneIds = project.scenes
        .filter((scene) =>
          !sceneHasValidAudio({
            audioContentHash: scene.audioContentHash,
            audioPath: scene.audioPath,
            script: scene.script,
            voiceProfileId: project.voiceProfileId
          })
        )
        .map((scene) => scene.id);

      return reply.status(409).send({
        error: "AUDIO_REQUIRED",
        invalidSceneIds,
        message: "Existem cenas sem áudio válido para iniciar o render"
      });
    }

    const renderJob = await prisma.renderJob.create({
      data: {
        projectId: project.id,
        status: "queued"
      }
    });

    await prisma.project.update({
      where: { id: project.id },
      data: {
        status: "rendering"
      }
    });

    return reply.status(201).send(renderJob);
  });
}
