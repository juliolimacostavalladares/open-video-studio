import { expect, test } from "@playwright/test";

test.describe("render queue and status tracking", () => {
  test("submits render and polls status until completion", async ({ page }) => {
    let getRenderCalls = 0;

    // Mock project details
    await page.route("**/projects/mock-project-id", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "mock-project-id",
          title: "E2E Render Project",
          rawScript: "[CENA 1]\nTexto de teste.",
          status: "draft",
          voiceProfileId: "voice-id",
        }),
      });
    });

    // Mock scenes list
    await page.route("**/projects/mock-project-id/scenes", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          projectId: "mock-project-id",
          scenes: [
            {
              id: "scene-1",
              title: "Cena 1",
              orderIndex: 0,
              script: "Texto de teste.",
              status: "ready",
              hasValidAudio: true,
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
        body: JSON.stringify([
          {
            id: "voice-id",
            name: "Narrador E2E",
            provider: "omnivoice-studio",
            sampleDurationSeconds: 1.0,
            status: "active",
          },
        ]),
      });
    });

    // Mock POST /projects/:id/renders and GET /projects/:id/renders
    await page.route("**/projects/mock-project-id/renders", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            id: "job-id",
            projectId: "mock-project-id",
            status: "queued",
          }),
        });
        return;
      }

      getRenderCalls += 1;
      let status = "queued";
      if (getRenderCalls === 2) {
        status = "running";
      } else if (getRenderCalls >= 3) {
        status = "succeeded";
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "job-id",
          projectId: "mock-project-id",
          status,
          outputPath: status === "succeeded" ? "render-succeeded.mp4" : null,
        }),
      });
    });

    // Go to project edit page
    await page.goto("/projects/mock-project-id/edit");

    // Click the render button
    const renderButton = page.locator("#queue-render");
    await expect(renderButton).toBeVisible();
    await renderButton.click();

    // Verify first queued/starting state
    const renderStatus = page.locator("#render-status");
    await expect(renderStatus).toContainText("Render enfileirado...");

    // Wait and verify rendering transition
    await expect(renderStatus).toContainText("Renderizando...", {
      timeout: 10000,
    });

    // Wait and verify success state
    await expect(renderStatus).toContainText("Renderizado com sucesso!", {
      timeout: 10000,
    });
  });

  test("shows error when render fails", async ({ page }) => {
    let getRenderCalls = 0;

    await page.route("**/projects/mock-project-id", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "mock-project-id",
          title: "E2E Render Project",
          rawScript: "[CENA 1]\nTexto de teste.",
          status: "draft",
          voiceProfileId: "voice-id",
        }),
      });
    });

    await page.route("**/projects/mock-project-id/scenes", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          projectId: "mock-project-id",
          scenes: [
            {
              id: "scene-1",
              title: "Cena 1",
              orderIndex: 0,
              script: "Texto de teste.",
              status: "ready",
              hasValidAudio: true,
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
        body: JSON.stringify([
          {
            id: "voice-id",
            name: "Narrador E2E",
            provider: "omnivoice-studio",
            sampleDurationSeconds: 1.0,
            status: "active",
          },
        ]),
      });
    });

    await page.route("**/projects/mock-project-id/renders", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            id: "job-id",
            projectId: "mock-project-id",
            status: "queued",
          }),
        });
        return;
      }

      getRenderCalls += 1;
      let status = "queued";
      let errorMessage = null;
      if (getRenderCalls === 2) {
        status = "running";
      } else if (getRenderCalls >= 3) {
        status = "failed";
        errorMessage = "Falha crítica no Remotion renderer";
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "job-id",
          projectId: "mock-project-id",
          status,
          errorMessage,
        }),
      });
    });

    await page.goto("/projects/mock-project-id/edit");

    const renderButton = page.locator("#queue-render");
    await renderButton.click();

    const renderStatus = page.locator("#render-status");
    await expect(renderStatus).toContainText("Render enfileirado...");
    await expect(renderStatus).toContainText("Renderizando...", {
      timeout: 10000,
    });
    await expect(renderStatus).toContainText(
      "Erro no render: Falha crítica no Remotion renderer",
      { timeout: 10000 },
    );
  });
});
