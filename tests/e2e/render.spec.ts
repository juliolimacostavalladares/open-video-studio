import { expect, test } from "@playwright/test";

test.describe("render queue and status tracking", () => {
  test.beforeEach(async ({ page }) => {
    page.on("console", (msg) =>
      console.log(`[BROWSER CONSOLE] [${msg.type()}] ${msg.text()}`),
    );
    page.on("request", (req) =>
      console.log(`[BROWSER REQ] ${req.method()} ${req.url()}`),
    );
    page.on("response", (res) =>
      console.log(`[BROWSER RES] ${res.status()} ${res.url()}`),
    );
  });

  test("submits render and polls status until completion", async ({ page }) => {
    let renderStarted = false;
    let getRenderCalls = 0;

    // Mock project details
    await page.route("**/projects/mock-project-id", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({
          id: "mock-project-id",
          title: "E2E Render Project",
          rawScript: "[CENA 1]\nTexto de teste.",
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
        headers: { "Access-Control-Allow-Origin": "*" },
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
      const method = route.request().method();
      if (method === "OPTIONS") {
        await route.fulfill({
          status: 200,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "content-type",
          },
        });
        return;
      }

      if (method === "POST") {
        renderStarted = true;
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          headers: { "Access-Control-Allow-Origin": "*" },
          body: JSON.stringify({
            id: "job-id",
            projectId: "mock-project-id",
            status: "queued",
          }),
        });
        return;
      }

      if (!renderStarted) {
        await route.fulfill({
          status: 404,
          contentType: "application/json",
          headers: { "Access-Control-Allow-Origin": "*" },
          body: JSON.stringify({
            error: "NOT_FOUND",
            message: "Nenhum job encontrado",
          }),
        });
        return;
      }

      getRenderCalls += 1;
      let status = "queued";
      if (getRenderCalls >= 4 && getRenderCalls <= 6) {
        status = "running";
      } else if (getRenderCalls >= 7) {
        status = "succeeded";
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({
          id: "job-id",
          projectId: "mock-project-id",
          status,
          outputPath:
            status === "succeeded" ? "renders/render-succeeded.mp4" : null,
        }),
      });
    });

    // Go to project review page
    await page.goto("/projects/mock-project-id/review");

    // Initially, there should be no render state shown in the video player section
    const noRenderState = page.locator("#no-render-state");
    await expect(noRenderState).toBeVisible();

    // Click the render button (located directly on the review page empty state)
    const renderButton = page.locator("#queue-render");
    await expect(renderButton).toBeVisible();
    await renderButton.click();

    // Verify first queued/starting state in both status message and player
    const renderStatus = page.locator("#render-status");
    await expect(renderStatus).toContainText("Render enfileirado com sucesso");

    const statusBadge = page.locator("#video-render-status-badge");
    await expect(statusBadge).toContainText("Na Fila");
    await expect(page.locator("#rendering-queued-state")).toBeVisible();

    // Wait and verify rendering transition in player status
    await expect(statusBadge).toContainText("Processando", { timeout: 20000 });
    await expect(page.locator("#rendering-running-state")).toBeVisible();

    // Wait and verify success state in badge and player visibility
    await expect(page.locator("#ready-for-review-state")).toBeVisible({
      timeout: 20000,
    });

    // Check that video player is rendered with correct url
    const videoPlayer = page.locator("#rendered-video-player");
    await expect(videoPlayer).toBeVisible();
    await expect(videoPlayer).toHaveAttribute(
      "src",
      /.*\/renders\/render-succeeded.mp4$/,
    );
  });

  test("shows error when render fails", async ({ page }) => {
    let renderStarted = false;
    let getRenderCalls = 0;

    await page.route("**/projects/mock-project-id", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({
          id: "mock-project-id",
          title: "E2E Render Project",
          rawScript: "[CENA 1]\nTexto de teste.",
          status: "ready_for_review",
          voiceProfileId: "voice-id",
          estimatedDuration: 15,
        }),
      });
    });

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
        headers: { "Access-Control-Allow-Origin": "*" },
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
      const method = route.request().method();
      if (method === "OPTIONS") {
        await route.fulfill({
          status: 200,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "content-type",
          },
        });
        return;
      }

      if (method === "POST") {
        renderStarted = true;
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          headers: { "Access-Control-Allow-Origin": "*" },
          body: JSON.stringify({
            id: "job-id",
            projectId: "mock-project-id",
            status: "queued",
          }),
        });
        return;
      }

      if (!renderStarted) {
        await route.fulfill({
          status: 404,
          contentType: "application/json",
          headers: { "Access-Control-Allow-Origin": "*" },
          body: JSON.stringify({
            error: "NOT_FOUND",
            message: "Nenhum job encontrado",
          }),
        });
        return;
      }

      getRenderCalls += 1;
      let status = "queued";
      let errorMessage = null;
      if (getRenderCalls >= 4 && getRenderCalls <= 6) {
        status = "running";
      } else if (getRenderCalls >= 7) {
        status = "failed";
        errorMessage = "Falha crítica no Remotion renderer";
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({
          id: "job-id",
          projectId: "mock-project-id",
          status,
          errorMessage,
        }),
      });
    });

    await page.goto("/projects/mock-project-id/review");

    const renderButton = page.locator("#queue-render");
    await renderButton.click();

    const renderStatus = page.locator("#render-status");
    await expect(renderStatus).toContainText("Render enfileirado com sucesso");

    const statusBadge = page.locator("#video-render-status-badge");
    await expect(statusBadge).toContainText("Na Fila");

    await expect(statusBadge).toContainText("Processando", { timeout: 20000 });

    await expect(statusBadge).toContainText("Erro", { timeout: 20000 });
    await expect(page.locator("#rendering-failed-state")).toBeVisible();
    await expect(page.locator("#rendering-failed-state")).toContainText(
      "Falha crítica no Remotion renderer",
    );
  });
});
