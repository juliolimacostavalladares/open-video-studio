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

test.describe("voice profile upload and narration editing", () => {
  test("creates a voice profile, edits scene scripts and generates narration audios", async ({
    page,
  }) => {
    const profiles: Array<{
      id: string;
      name: string;
      provider: string;
      sampleDurationSeconds: number;
      status: string;
    }> = [];

    let generateCallCount = 0;
    const scenes = [
      {
        id: "scene-1",
        title: "Cena 1",
        script: "Texto base da primeira cena.",
        orderIndex: 0,
        status: "draft",
        hasValidAudio: false,
        audioPath: null,
        audioDurationSeconds: null,
      },
      {
        id: "scene-2",
        title: "Cena 2",
        script: "Texto base da segunda cena.",
        orderIndex: 1,
        status: "draft",
        hasValidAudio: false,
        audioPath: null,
        audioDurationSeconds: null,
      },
    ];

    // Mock voice profiles list & create
    await page.route("**/voice-profiles", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(profiles),
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
          body: JSON.stringify({
            message: "Formato de áudio inválido. Envie um arquivo WAV",
          }),
        });
        return;
      }

      const created = {
        id: "voice-created",
        name,
        provider: "omnivoice-studio",
        sampleDurationSeconds: 3.4,
        status: "active",
      };
      profiles.unshift(created);

      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(created),
      });
    });

    // Mock project API
    await page.route("**/projects/mock-project-id", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "mock-project-id",
          title: "Projeto com Voz",
          rawScript:
            "[CENA 1]\nTexto base da primeira cena.\n[CENA 2]\nTexto base da segunda cena.",
          status: "draft",
          voiceProfileId: "voice-created",
        }),
      });
    });

    // Mock project scenes API
    await page.route("**/projects/mock-project-id/scenes", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          projectId: "mock-project-id",
          scenes,
        }),
      });
    });

    // Mock scene script patch
    await page.route(
      "**/projects/mock-project-id/scenes/scene-1",
      async (route) => {
        const payload = route.request().postDataJSON() as { script?: string };
        if (payload.script !== undefined) {
          scenes[0].script = payload.script;
        }
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(scenes[0]),
        });
      },
    );

    // Mock audio generate API
    await page.route(
      "**/projects/mock-project-id/scenes/audio/generate",
      async (route) => {
        generateCallCount += 1;
        if (generateCallCount === 1) {
          scenes[0].hasValidAudio = true;
          scenes[0].audioPath = "audio/scene-1.wav";
          scenes[0].audioDurationSeconds = 4.2;

          scenes[1].hasValidAudio = true;
          scenes[1].audioPath = "audio/scene-2.wav";
          scenes[1].audioDurationSeconds = 3.8;

          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              generatedCount: 2,
              projectId: "mock-project-id",
              scenes,
              skippedCount: 0,
            }),
          });
        } else {
          scenes[0].hasValidAudio = true;
          scenes[0].audioPath = "audio/scene-1-new.wav";
          scenes[0].audioDurationSeconds = 5.0;

          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              generatedCount: 1,
              projectId: "mock-project-id",
              scenes,
              skippedCount: 1,
            }),
          });
        }
      },
    );

    // Mock play preview audio binary
    await page.route("**/audio/scene-1.wav", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "audio/wav",
        body: Buffer.from("preview-wav-data"),
      });
    });

    // 1. Visit voices list page to upload voice
    await page.goto("/voices");

    await page.locator("#voice-profile-name").fill("Narrador E2E");
    await page.locator("#voice-sample-input").setInputFiles({
      name: "invalid.mp3",
      mimeType: "audio/mpeg",
      buffer: Buffer.from("not-audio"),
    });
    await page.locator("#voice-profile-submit").click();
    await expect(page.locator("#voice-profile-error")).toContainText(
      "Formato de áudio inválido",
    );

    await page.locator("#voice-sample-input").setInputFiles({
      name: "valid.wav",
      mimeType: "audio/wav",
      buffer: Buffer.from(buildWavBase64(3.4), "base64"),
    });
    await page.locator("#voice-profile-submit").click();

    await expect(page.locator("#voice-profile-list")).toContainText(
      "Narrador E2E",
    );

    // 2. Go to project editor
    await page.goto("/projects/mock-project-id/edit");

    // Open "Voz" tab
    await page.getByRole("button", { name: "Voz", exact: true }).click();

    // Verify scenes are listed in the Voice tab when selected via timeline
    await expect(
      page.locator(".voice-scene-title").filter({ hasText: "Cena 1" }),
    ).toBeVisible();

    // Click Cena 2 audio block in the timeline to select it and focus the voice tab on it
    await page.locator(".timeline-audio-block").nth(1).click();
    await expect(
      page.locator(".voice-scene-title").filter({ hasText: "Cena 2" }),
    ).toBeVisible();

    // Click Cena 1 audio block to select it again
    await page.locator(".timeline-audio-block").nth(0).click();
    await expect(
      page.locator(".voice-scene-title").filter({ hasText: "Cena 1" }),
    ).toBeVisible();

    // Click "Gerar Todos os Áudios" button
    const generateBtn = page.locator("#generate-scene-audio");
    await generateBtn.click();

    // Verify success banner contains the count of generated audios
    await expect(page.locator("#scene-audio-status")).toContainText(
      "Geração completa! 2 cena(s) processada(s)",
    );

    // Play/preview audio for Cena 1
    const playBtn = page.locator("#preview-scene-scene-1");
    await expect(playBtn).toBeVisible();
    await playBtn.click();
    await expect(page.locator("#scene-preview-audio")).toBeVisible();

    // Edit Cena 1 narration text
    const editor = page.locator("#script-editor").first();
    await editor.fill("Texto modificado para testar regeneração.");

    // Trigger generate all to save and regenerate modified scene
    await generateBtn.click();
    await expect(page.locator("#scene-audio-status")).toContainText(
      "Geração completa! 1 cena(s) processada(s)",
    );
  });
});
