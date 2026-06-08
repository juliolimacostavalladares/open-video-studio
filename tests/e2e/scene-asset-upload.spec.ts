import { expect, test } from "@playwright/test";

test.describe("scene asset upload E2E", () => {
  test("allows uploading asset manually for a scene and updates status", async ({
    page,
  }) => {
    const rawScript = `[CENA 1 - Cena 1]
Texto base da primeira cena.`;

    const scenes = [
      {
        id: "scene-1",
        title: "Cena 1",
        script: "Texto base da primeira cena.",
        keywords: ["cena", "primeira"],
        assetId: null,
        asset: null,
      },
    ];

    // Mock project API
    await page.route("**/projects/mock-project-id", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "mock-project-id",
          title: "Projeto com Assets",
          rawScript,
          status: "draft",
          voiceProfileId: null,
        }),
      });
    });

    // Mock list scenes API
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

    // Mock voice profiles list
    await page.route("**/voice-profiles", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });

    // Mock POST upload asset API
    let uploadCalled = false;
    await page.route(
      "**/projects/mock-project-id/scenes/scene-1/asset",
      async (route) => {
        uploadCalled = true;
        // Update scene with mock asset
        scenes[0].assetId = "asset-1";
        scenes[0].asset = {
          id: "asset-1",
          kind: "image",
          path: "assets/manual/asset-1.png",
          source: "upload",
          status: "ready",
        };

        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(scenes[0]),
        });
      },
    );

    page.on("console", (msg) =>
      console.log("BROWSER CONSOLE:", msg.text(), "at", msg.location().url),
    );
    page.on("pageerror", (err) =>
      console.log("BROWSER EXCEPTION:", err.message, err.stack),
    );

    // Go to edit page
    await page.goto("/projects/mock-project-id/edit");

    // Check header and initial status
    await expect(
      page.getByText("Gerenciador de Assets por Cena"),
    ).toBeVisible();
    await expect(page.locator("#scene-asset-status-scene-1")).toContainText(
      "Fallback Visual Ativo",
    );

    // Perform file upload simulation
    const fileChooserPromise = page.waitForEvent("filechooser");
    await page.click("text=Substituir Asset (Upload)");
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: "test-scene-asset.png",
      mimeType: "image/png",
      buffer: Buffer.from("fake-png-binary-data"),
    });

    // Verify upload API call was made and the UI reflects the manual asset
    await expect(
      page.getByText("Asset enviado e associado com sucesso!"),
    ).toBeVisible();
    expect(uploadCalled).toBe(true);
    await expect(page.locator("#scene-asset-status-scene-1")).toContainText(
      "Imagem Manual",
    );
  });
});
