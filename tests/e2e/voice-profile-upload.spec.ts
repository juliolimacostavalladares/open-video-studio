import { expect, test } from "@playwright/test";

function buildWavBase64(durationSeconds: number) {
  const sampleRate = 24000;
  const channels = 1;
  const bitsPerSample = 16;
  const blockAlign = (channels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;
  const dataSize = Math.floor(durationSeconds * byteRate);
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  return buffer.toString("base64");
}

test.describe("voice profile upload", () => {
  test("uploads voice, generates per-scene audio and only regenerates the edited scene", async ({ page }) => {
    const profiles: Array<{
      id: string;
      name: string;
      provider: string;
      sampleDurationSeconds: number;
      status: string;
    }> = [];
    let generateCallCount = 0;
    let rawScript = `[CENA 1 - Cena 1]
Texto base da primeira cena.

[CENA 2 - Cena 2]
Texto base da segunda cena.`;
    const scenes = [
      {
        hasValidAudio: false,
        id: "scene-1",
        script: "Texto base da primeira cena.",
        title: "Cena 1"
      },
      {
        hasValidAudio: false,
        id: "scene-2",
        script: "Texto base da segunda cena.",
        title: "Cena 2"
      }
    ];
    let selectedVoiceProfileId: string | null = null;

    await page.route("**/projects/mock-project-id", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "mock-project-id",
          title: "Projeto com Voz",
          rawScript,
          status: "draft",
          voiceProfileId: selectedVoiceProfileId
        })
      });
    });

    await page.route("**/projects/mock-project-id/scenes", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          projectId: "mock-project-id",
          scenes
        })
      });
    });

    await page.route("**/projects/mock-project-id/script", async (route) => {
      const payload = route.request().postDataJSON() as { rawScript: string };
      rawScript = payload.rawScript;
      scenes[1] = {
        ...scenes[1],
        hasValidAudio: false,
        script: "Texto base da segunda cena alterada."
      };

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "mock-project-id",
          title: "Projeto com Voz",
          rawScript,
          status: "scripting",
          updatedAt: new Date().toISOString(),
          estimatedDuration: 0,
          estimatedDurationMin: 0,
          estimatedDurationMax: 0
        })
      });
    });

    await page.route("**/voice-profiles", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(profiles)
        });
        return;
      }

      const rawBody = route.request().postDataBuffer()?.toString("utf-8") ?? "";
      const nameMatch = /name="name"\r\n\r\n([^\r]+)/.exec(rawBody);
      const fileNameMatch = /name="sample"; filename="([^"]+)"/.exec(rawBody);
      const name = nameMatch?.[1] ?? "";
      const fileName = fileNameMatch?.[1] ?? "";

      if (fileName.endsWith(".mp3")) {
        await route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({ message: "Formato de áudio inválido. Envie um arquivo WAV" })
        });
        return;
      }

      const created = {
        id: "voice-created",
        name,
        provider: "omnivoice-studio",
        sampleDurationSeconds: 3.4,
        status: "active"
      };
      profiles.unshift(created);

      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(created)
      });
    });

    await page.route("**/projects/mock-project-id/voice-profile", async (route) => {
      const payload = route.request().postDataJSON() as { voiceProfileId: string | null };
      selectedVoiceProfileId = payload.voiceProfileId;

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "mock-project-id",
          title: "Projeto com Voz",
          rawScript,
          status: "draft",
          voiceProfileId: selectedVoiceProfileId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          estimatedDuration: 0,
          estimatedDurationMin: 0,
          estimatedDurationMax: 0
        })
      });
    });

    await page.route("**/projects/mock-project-id/scenes/audio/generate", async (route) => {
      generateCallCount += 1;

      if (generateCallCount === 1) {
        scenes[0] = { ...scenes[0], hasValidAudio: true };
        scenes[1] = { ...scenes[1], hasValidAudio: true };
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            generatedCount: 2,
            projectId: "mock-project-id",
            scenes,
            skippedCount: 0
          })
        });
        return;
      }

      scenes[1] = { ...scenes[1], hasValidAudio: true };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          generatedCount: 1,
          projectId: "mock-project-id",
          scenes,
          skippedCount: 1
        })
      });
    });

    await page.route("**/projects/mock-project-id/renders", async (route) => {
      const hasInvalidAudio = scenes.some((scene) => !scene.hasValidAudio);
      if (hasInvalidAudio) {
        await route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({ message: "Existem cenas sem áudio válido para iniciar o render" })
        });
        return;
      }

      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          id: "render-1",
          projectId: "mock-project-id",
          status: "queued"
        })
      });
    });

    await page.route("**/projects/mock-project-id/scenes/scene-1/preview", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "audio/wav",
        body: Buffer.from("preview-wav")
      });
    });

    await page.route("**/projects/mock-project-id/scenes/scene-2/preview", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "audio/wav",
        body: Buffer.from("preview-wav-2")
      });
    });

    await page.goto("/projects/mock-project-id/edit");

    await page.locator("#voice-profile-name").fill("Narrador E2E");
    await page.locator("#voice-sample-input").setInputFiles({
      name: "invalid.mp3",
      mimeType: "audio/mpeg",
      buffer: Buffer.from("not-audio")
    });
    await page.locator("#voice-profile-submit").click();
    await expect(page.locator("#voice-profile-error")).toContainText("Formato de áudio inválido");

    await page.locator("#voice-sample-input").setInputFiles({
      name: "valid.wav",
      mimeType: "audio/wav",
      buffer: Buffer.from(buildWavBase64(3.4), "base64")
    });
    await page.locator("#voice-profile-submit").click();

    await expect(page.locator("#voice-profile-list")).toContainText("Narrador E2E");
    await page.locator('input[name="selected-voice-profile"]').first().check();
    await page.locator("#save-project-voice").click();
    await expect(page.locator("#voice-selection-status")).toContainText("Voz salva");

    await page.locator("#queue-render").click();
    await expect(page.locator("#render-status")).toContainText("Existem cenas sem áudio válido");

    await page.locator("#generate-scene-audio").click();
    await expect(page.locator("#scene-audio-status")).toContainText("2 cena(s) gerada(s), 0 reaproveitada(s)");

    await page.locator("#preview-scene-scene-1").click();
    await expect(page.locator("#scene-preview-audio")).toBeVisible();

    await page.locator("#script-editor").fill(`[CENA 1 - Cena 1]
Texto base da primeira cena.

[CENA 2 - Cena 2]
Texto base da segunda cena alterada.`);
    await page.locator("#save-button").click();

    await page.locator("#generate-scene-audio").click();
    await expect(page.locator("#scene-audio-status")).toContainText("1 cena(s) gerada(s), 1 reaproveitada(s)");

    await page.locator("#queue-render").click();
    await expect(page.locator("#render-status")).toContainText("Render enfileirado com sucesso");
  });
});
