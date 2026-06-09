import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { renderVideo } from "@repo/infrastructure";

describe("remotion rendering smoke test", () => {
  const tempDir = join(process.cwd(), ".tmp/remotion-smoke-tests");

  beforeAll(() => {
    mkdirSync(tempDir, { recursive: true });
  });

  afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("successfully renders a video with only text (no assets)", async () => {
    const outputPath = join(tempDir, "output-text-only.mp4");
    const props = {
      scenes: [
        {
          id: "scene-1",
          orderIndex: 0,
          script: "Texto de teste sem assets.",
          audioDurationSeconds: 1.0,
        },
      ],
    };

    await renderVideo(props, outputPath);
    expect(existsSync(outputPath)).toBe(true);
  }, 180000);

  it("successfully renders a video with image asset but no audio", async () => {
    const outputPath = join(tempDir, "output-image-only.mp4");
    const base64Png =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
    const imageDataUrl = `data:image/png;base64,${base64Png}`;

    const props = {
      scenes: [
        {
          id: "scene-1",
          orderIndex: 0,
          script: "Texto com imagem.",
          audioDurationSeconds: 1.0,
          assetPath: imageDataUrl,
          assetKind: "image" as const,
        },
      ],
    };

    await renderVideo(props, outputPath);
    expect(existsSync(outputPath)).toBe(true);
  }, 180000);

  it("successfully renders a video with image and audio assets", async () => {
    const outputPath = join(tempDir, "output-full.mp4");

    // Generate a 1-second silent WAV at 8000Hz, 8-bit mono
    const silentWavHeader = Buffer.from([
      0x52,
      0x49,
      0x46,
      0x46, // "RIFF"
      0x24,
      0x1f,
      0x00,
      0x00, // file size - 8
      0x57,
      0x41,
      0x56,
      0x45, // "WAVE"
      0x66,
      0x6d,
      0x74,
      0x20, // "fmt "
      0x10,
      0x00,
      0x00,
      0x00, // chunk size (16)
      0x01,
      0x00, // compression code (1 - PCM)
      0x01,
      0x00, // channels (1)
      0x40,
      0x1f,
      0x00,
      0x00, // sample rate (8000)
      0x40,
      0x1f,
      0x00,
      0x00, // byte rate (8000)
      0x01,
      0x00, // block align (1)
      0x08,
      0x00, // bits per sample (8)
      0x64,
      0x61,
      0x74,
      0x61, // "data"
      0x00,
      0x1f,
      0x00,
      0x00, // chunk size (8000 bytes)
    ]);
    const silentWavData = Buffer.alloc(8000, 128); // 8-bit PCM silence is 128
    const silentWav = Buffer.concat([silentWavHeader, silentWavData]);
    const audioDataUrl = `data:audio/wav;base64,${silentWav.toString("base64")}`;

    const base64Png =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
    const imageDataUrl = `data:image/png;base64,${base64Png}`;

    const props = {
      scenes: [
        {
          id: "scene-1",
          orderIndex: 0,
          script: "Texto com imagem e áudio.",
          audioPath: audioDataUrl,
          audioDurationSeconds: 1.0,
          assetPath: imageDataUrl,
          assetKind: "image" as const,
        },
      ],
    };

    await renderVideo(props, outputPath);
    expect(existsSync(outputPath)).toBe(true);
  }, 180000);
});
