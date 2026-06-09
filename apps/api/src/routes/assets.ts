import type { FastifyInstance } from "fastify";
import { createStorageService } from "@repo/infrastructure";

export async function assetsRoutes(app: FastifyInstance): Promise<void> {
  const storage = createStorageService();

  // Route to serve audio files
  app.get<{ Params: { "*": string } }>("/audio/*", async (request, reply) => {
    const key = request.params["*"];
    try {
      const obj = await storage.getObject("audio", key);
      reply.header("Content-Type", obj.contentType || "audio/wav");
      return reply.send(obj.body);
    } catch {
      return reply
        .status(404)
        .send({ error: "NOT_FOUND", message: "Áudio não encontrado" });
    }
  });

  // Route to serve asset files (images/videos)
  app.get<{ Params: { "*": string } }>("/assets/*", async (request, reply) => {
    const key = request.params["*"];

    // Check if it's the fallback placeholder
    if (key === "fallbacks/default-placeholder.png") {
      // Return a simple 1x1 transparent PNG
      const base64Png =
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
      const buffer = Buffer.from(base64Png, "base64");
      reply.header("Content-Type", "image/png");
      return reply.send(buffer);
    }

    try {
      const obj = await storage.getObject("assets", key);
      reply.header("Content-Type", obj.contentType || "image/png");
      return reply.send(obj.body);
    } catch {
      return reply
        .status(404)
        .send({ error: "NOT_FOUND", message: "Asset não encontrado" });
    }
  });

  // Route to serve render files
  app.get<{ Params: { "*": string } }>("/renders/*", async (request, reply) => {
    const key = request.params["*"];
    try {
      const obj = await storage.getObject("renders", key);
      reply.header("Content-Type", obj.contentType || "video/mp4");
      return reply.send(obj.body);
    } catch {
      return reply
        .status(404)
        .send({ error: "NOT_FOUND", message: "Render não encontrado" });
    }
  });
}
