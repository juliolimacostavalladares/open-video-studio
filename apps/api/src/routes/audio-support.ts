import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { createStorageService } from "@repo/infrastructure";

export function stripAudioNamespace(path: string) {
  return path.startsWith("audio/") ? path.slice("audio/".length) : path;
}

export async function createVoiceSampleFile(samplePath: string, name = "reference.wav") {
  const storage = createStorageService();
  const storedSample = await storage.getObject("audio", stripAudioNamespace(samplePath));
  const tempDir = await mkdtemp(join(tmpdir(), "open-video-studio-voice-"));
  const tempSamplePath = join(tempDir, name);

  await writeFile(tempSamplePath, storedSample.body);

  return {
    async cleanup() {
      await rm(tempDir, { force: true, recursive: true });
    },
    tempSamplePath
  };
}
