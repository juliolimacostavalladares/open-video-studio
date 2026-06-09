import { expect, test } from "@playwright/test";

test.describe("project review screen", () => {
  test.beforeEach(async ({ page }) => {
    // Mock project details
    await page.route("**/projects/mock-project-id", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({
          id: "mock-project-id",
          title: "Review E2E Project",
          description: "This is a test project description for E2E review.",
          rawScript: "[CENA 1]\nTexto de teste para a cena.",
          status: "ready_for_review",
          voiceProfileId: "voice-id",
          estimatedDuration: 15,
        }),
      });
    });

    // Mock scenes list
    await page.route("**/projects/mock-project-id/scenes", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({
          projectId: "mock-project-id",
          scenes: [
            {
              id: "scene-1",
              title: "Cena 1",
              orderIndex: 0,
              script: "Texto de teste para a cena.",
              status: "ready",
            },
          ],
        }),
      });
    });

    // Mock voice profiles list
    await page.route("**/voice-profiles", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify([
          {
            id: "voice-id",
            name: "Narrador E2E Review",
            provider: "omnivoice-studio",
            sampleDurationSeconds: 1.0,
            status: "active",
          },
        ]),
      });
    });
  });

  test("displays project summary and plays the final video when render is ready", async ({
    page,
  }) => {
    // Mock succeeded render job
    await page.route("**/projects/mock-project-id/renders", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({
          id: "job-id",
          projectId: "mock-project-id",
          status: "succeeded",
          outputPath: "renders/mock-review-video.mp4",
        }),
      });
    });

    // Go to project review page
    await page.goto("/projects/mock-project-id/review");

    // Verify title and header status label
    await expect(page.locator("h1")).toContainText("Revisão do Vídeo");
    await expect(page.locator("#review-status-label")).toContainText(
      "Pronto para Revisão",
    );

    // Verify project summary
    await expect(page.locator("header")).toContainText("Review E2E Project");
    const summaryCard = page.locator("#project-summary-section");
    await expect(summaryCard).toBeVisible();
    await expect(summaryCard).toContainText(
      "This is a test project description for E2E review.",
    );
    await expect(summaryCard).toContainText("Narrador E2E Review");

    // Verify final video player is visible and has correct url
    const player = page.locator("#rendered-video-player");
    await expect(player).toBeVisible();
    await expect(player).toHaveAttribute(
      "src",
      /.*\/renders\/mock-review-video.mp4$/,
    );

    // Verify ready message
    await expect(page.locator("#ready-for-review-state")).toContainText(
      "Pronto para revisão!",
    );

    // Verify back to editor link
    const backBtn = page.locator("#back-to-edit");
    await expect(backBtn).toBeVisible();
    await expect(backBtn).toHaveAttribute(
      "href",
      "/projects/mock-project-id/edit",
    );
  });

  test("shows clear message and link to editor when render is missing", async ({
    page,
  }) => {
    // Mock 404 (no render job)
    await page.route("**/projects/mock-project-id/renders", async (route) => {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({
          error: "NOT_FOUND",
          message: "Nenhum job de renderização encontrado",
        }),
      });
    });

    // Go to project review page
    await page.goto("/projects/mock-project-id/review");

    // Verify fallback empty state message
    const emptyState = page.locator("#no-render-state");
    await expect(emptyState).toBeVisible();
    await expect(emptyState).toContainText(
      "Vídeo não renderizado ou render ainda em progresso",
    );

    // Video player should NOT be visible
    await expect(page.locator("#rendered-video-player")).not.toBeVisible();
  });
});
