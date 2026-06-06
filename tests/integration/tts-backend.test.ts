import { createServer } from "node:http";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { OmniVoiceStudioTTSBackend } from "../../packages/infrastructure/src/index.js";

let backendUrl = "";
let capturedBody = "";
let server: ReturnType<typeof createServer>;

beforeAll(async () => {
  server = createServer((request, response) => {
    if (request.method === "POST" && request.url === "/generate") {
      const chunks: Buffer[] = [];

      request.on("data", (chunk) => {
        chunks.push(Buffer.from(chunk));
      });

      request.on("end", () => {
        capturedBody = Buffer.concat(chunks).toString("utf-8");
        response.writeHead(200, {
          "Content-Type": "audio/wav",
          "X-Audio-Duration": "2.5",
          "X-Audio-Id": "integration-audio",
          "X-Audio-Path": "integration-audio.wav"
        });
        response.end(Buffer.from("integration-wav"));
      });

      return;
    }

    response.writeHead(404);
    response.end();
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        throw new Error("Failed to bind mock TTS server");
      }

      backendUrl = `http://127.0.0.1:${address.port}`;
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
});

describe("OmniVoiceStudioTTSBackend integration", () => {
  it("calls the local OmniVoice Studio backend with a mock profile id", async () => {
    const backend = new OmniVoiceStudioTTSBackend({
      baseUrl: backendUrl,
      timeoutMs: 1000
    });

    const artifact = await backend.synthesize({
      text: "Scene one narration",
      voiceProfile: {
        id: "voice-1",
        providerVoiceId: "omnivoice-profile-1"
      }
    });

    expect(capturedBody).toContain('name="text"');
    expect(capturedBody).toContain("Scene one narration");
    expect(capturedBody).toContain('name="profile_id"');
    expect(capturedBody).toContain("omnivoice-profile-1");
    expect(artifact.audio.toString("utf-8")).toBe("integration-wav");
    expect(artifact.audioDurationSeconds).toBe(2.5);
    expect(artifact.audioId).toBe("integration-audio");
    expect(artifact.audioPath).toBe("integration-audio.wav");
    expect(artifact.contentType).toBe("audio/wav");
  });
});
