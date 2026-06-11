import { expect, test } from "@playwright/test";

test.describe("scene visual fallback E2E", () => {
  test("displays Fallback Visual Ativo notice for scenes without manual assets", async ({
    page,
  }) => {
    const rawScript = `[CENA 1 - Cena Fallback]
Texto da cena com fallback visual.`;

    const scenes = [
      {
        id: "scene-1",
        title: "Cena Fallback",
        script: "Texto da cena com fallback visual.",
        keywords: ["cena", "fallback"],
        assetId: "fallback-asset-id",
        asset: {
          id: "fallback-asset-id",
          kind: "image",
          path: "assets/fallbacks/default-placeholder.png",
          source: "external",
          status: "ready",
        },
      },
    ];

    // Mock project API
    await page.route("**/projects/mock-project-id", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "mock-project-id",
          title: "Projeto com Fallback",
          rawScript,
          status: "draft",
          voiceProfileId: null,
        }),
      });
    });

    // Mock list scenes API returning the fallback asset
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

    page.on("console", (msg) =>
      console.log("BROWSER CONSOLE:", msg.text(), "at", msg.location().url),
    );
    page.on("pageerror", (err) =>
      console.log("BROWSER EXCEPTION:", err.message, err.stack),
    );

    // Go to edit page
    await page.goto("/projects/mock-project-id/edit");
    await page.getByRole("button", { name: "Cenas", exact: true }).click();

    // Check header is visible
    await expect(
      page.getByText("Gerenciador de Assets por Cena"),
    ).toBeVisible();

    // Verify UI displays that the fallback visual is active
    await expect(page.locator("#scene-asset-status-scene-1")).toContainText(
      "⚠️ Fallback Visual Ativo",
    );

    // Verify manual upload action button is still visible and clickable
    await expect(page.getByText("Substituir Asset (Upload)")).toBeVisible();
  });
});
