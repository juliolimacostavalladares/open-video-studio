import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import type { FastifyInstance } from "fastify";

import { prisma } from "@repo/database";
import { OmniVoiceStudioTTSBackend, createStorageService } from "@repo/infrastructure";

function stripAudioNamespace(samplePath: string) {
  return samplePath.startsWith("audio/") ? samplePath.slice("audio/".length) : samplePath;
}

export async function audioPreviewRoutes(app: FastifyInstance): Promise<void> {
  const storage = createStorageService();
  const ttsBackend = new OmniVoiceStudioTTSBackend();

  app.post<{ Params: { id: string; sceneId: string } }>(
    "/projects/:id/scenes/:sceneId/preview",
    async (request, reply) => {
      const { id, sceneId } = request.params;

      const scene = await prisma.scene.findFirst({
        where: {
          id: sceneId,
          projectId: id
        },
        select: {
          id: true,
          script: true
        }
      });

      if (!scene) {
        return reply.status(404).send({ error: "NOT_FOUND", message: "Cena não encontrada" });
      }

      const project = await prisma.project.findUnique({
        where: { id },
        select: { voiceProfileId: true }
      });

      if (!project) {
        return reply.status(404).send({ error: "NOT_FOUND", message: "Projeto não encontrado" });
      }

      if (!project.voiceProfileId) {
        return reply.status(422).send({
          error: "UNPROCESSABLE",
          message: "Selecione uma voz antes de gerar preview"
        });
      }

      const voiceProfile = await prisma.voiceProfile.findUnique({
        where: { id: project.voiceProfileId },
        select: {
          id: true,
          provider: true,
          samplePath: true
        }
      });

      if (!voiceProfile) {
        return reply.status(404).send({ error: "NOT_FOUND", message: "Perfil de voz não encontrado" });
      }

      const storedSample = await storage.getObject("audio", stripAudioNamespace(voiceProfile.samplePath));
      const tempDir = await mkdtemp(join(tmpdir(), "open-video-studio-preview-"));
      const tempSamplePath = join(tempDir, `${voiceProfile.id}.wav`);

      try {
        await writeFile(tempSamplePath, storedSample.body);

        const artifact = await ttsBackend.synthesize({
          text: scene.script,
          voiceProfile: {
            id: voiceProfile.id,
            provider: voiceProfile.provider,
            samplePath: tempSamplePath
          }
        });

        reply.header("Content-Type", artifact.contentType);
        reply.header("Content-Length", String(artifact.audio.length));
        reply.header("X-Preview-Scene-Id", scene.id);
        reply.header("X-Preview-Voice-Profile-Id", voiceProfile.id);

        return reply.status(200).send(artifact.audio);
      } finally {
        await rm(tempDir, { force: true, recursive: true });
      }
    }
  );
}
