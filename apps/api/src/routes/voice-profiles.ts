import type { FastifyInstance } from "fastify";

import { prisma } from "@repo/database";
import { createStorageService } from "@repo/infrastructure";

import { validateVoiceSample } from "../voice-profiles/validation.js";

interface VoiceProfileResponse {
  createdAt: string;
  id: string;
  name: string;
  provider: string;
  sampleDurationSeconds: number;
  sampleMimeType: string;
  samplePath: string;
  status: string;
  updatedAt: string;
}

function toResponse(profile: {
  createdAt: Date;
  id: string;
  name: string;
  provider: string;
  sampleDurationSeconds: number;
  sampleMimeType: string;
  samplePath: string;
  status: string;
  updatedAt: Date;
}) : VoiceProfileResponse {
  return {
    createdAt: profile.createdAt.toISOString(),
    id: profile.id,
    name: profile.name,
    provider: profile.provider,
    sampleDurationSeconds: profile.sampleDurationSeconds,
    sampleMimeType: profile.sampleMimeType,
    samplePath: profile.samplePath,
    status: profile.status,
    updatedAt: profile.updatedAt.toISOString()
  };
}

export async function voiceProfilesRoutes(app: FastifyInstance): Promise<void> {
  const storage = createStorageService();

  app.get("/voice-profiles", async () => {
    const profiles = await prisma.voiceProfile.findMany({
      orderBy: { createdAt: "desc" }
    });

    return profiles.map(toResponse);
  });

  app.post("/voice-profiles", async (request, reply) => {
    let fileName = "";
    let mimeType = "";
    let name = "";
    let sampleBuffer: Buffer | null = null;

    for await (const part of request.parts()) {
      if (part.type === "field" && part.fieldname === "name" && typeof part.value === "string") {
        name = part.value.trim();
      }

      if (part.type === "file" && part.fieldname === "sample") {
        fileName = part.filename;
        mimeType = part.mimetype;
        sampleBuffer = await part.toBuffer();
      }
    }

    if (!sampleBuffer) {
      return reply.status(400).send({
        error: "BAD_REQUEST",
        message: "A amostra de voz é obrigatória"
      });
    }

    if (!name) {
      return reply.status(400).send({
        error: "BAD_REQUEST",
        message: "name é obrigatório"
      });
    }

    try {
      const metadata = validateVoiceSample({
        buffer: sampleBuffer,
        fileName,
        mimeType
      });

      const created = await prisma.voiceProfile.create({
        data: {
          name,
          provider: "omnivoice-studio",
          sampleDurationSeconds: metadata.durationSeconds,
          sampleMimeType: metadata.mimeType,
          samplePath: "",
          status: "active"
        }
      });

      const extension = fileName.toLowerCase().endsWith(".wav") ? ".wav" : "";
      const stored = await storage.putObject(
        "audio",
        `voice-profiles/${created.id}${extension}`,
        sampleBuffer,
        metadata.mimeType
      );

      const profile = await prisma.voiceProfile.update({
        where: { id: created.id },
        data: {
          samplePath: stored.key
        }
      });

      return reply.status(201).send(toResponse(profile));
    } catch (error) {
      return reply.status(400).send({
        error: "BAD_REQUEST",
        message: error instanceof Error ? error.message : "A amostra de voz é inválida"
      });
    }
  });
}
