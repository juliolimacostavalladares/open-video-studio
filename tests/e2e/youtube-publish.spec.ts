import { expect, test } from "@playwright/test";

test.describe("YouTube Publish and Fallback E2E", () => {
  test("handles successful publication, error display, and quota exceeded fallback to download only", async ({
    page,
  }) => {
    let mockPublishStatus = "idle";
    let mockPublishError: string | null = null;
    let mockVideoId: string | null = null;

    // Mock project details with dynamic youtube fields
    await page.route("**/projects/mock-project-id", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "mock-project-id",
          title: "E2E Publish Project",
          status: "approved", // Must be approved to publish
          youtubeChannelId: "mock-channel-id",
          youtubePublishStatus: mockPublishStatus,
          youtubePublishError: mockPublishError,
          youtubeVideoId: mockVideoId,
        }),
      });
    });

    // Mock renders status
    await page.route("**/projects/mock-project-id/renders", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "render-job-id",
          projectId: "mock-project-id",
          status: "succeeded",
          outputPath: "renders/mock-video.mp4",
          errorMessage: null,
        }),
      });
    });

    // Mock scenes list
    await page.route("**/projects/mock-project-id/scenes", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
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

    // Mock YouTube Channel connection details
    await page.route(
      "**/projects/mock-project-id/youtube-channel",
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            id: "mock-channel-id",
            channelId: "UC_MOCK_CHANNEL_ID_12345",
            title: "Mock Channel Solo Operator",
            thumbnail: "https://placehold.co/100x100?text=MockChannel",
          }),
        });
      },
    );

    // Mock Publish Endpoint (default success, dynamic response based on test steps)
    await page.route("**/projects/mock-project-id/publish", async (route) => {
      if (mockPublishStatus === "idle") {
        // Simulate quota exceeded
        mockPublishStatus = "download_only";
        mockPublishError =
          "Limite de quota do YouTube excedido. O vídeo está disponível apenas para download.";
        await route.fulfill({
          status: 403,
          contentType: "application/json",
          body: JSON.stringify({
            error: "QUOTA_EXCEEDED",
            message: mockPublishError,
          }),
        });
      }
    });

    // Mock Reset Endpoint
    await page.route(
      "**/projects/mock-project-id/youtube/reset",
      async (route) => {
        mockPublishStatus = "idle";
        mockPublishError = null;
        mockVideoId = null;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true }),
        });
      },
    );

    // Navigate to project review page
    await page.goto("/projects/mock-project-id/review");

    // Verify channel is connected
    await expect(page.locator("#youtube-channel-section")).toContainText(
      "Conectado",
    );

    // Button to publish must be visible
    const publishBtn = page.locator("#publish-project-btn");
    await expect(publishBtn).toBeVisible();

    // Click to publish (which triggers mock quota error 403)
    await publishBtn.click();

    // Verify UI entered download_only mode and displays fallback card
    const fallbackCard = page.locator("#youtube-status-fallback");
    await expect(fallbackCard).toBeVisible();
    await expect(fallbackCard).toContainText(
      "Fallback: Modo Apenas Download Ativo",
    );

    const downloadBtn = page.locator("#download-fallback-video-btn");
    await expect(downloadBtn).toBeVisible();

    // Reset status back to idle
    const resetBtn = page.locator("#retry-publish-btn");
    await expect(resetBtn).toBeVisible();
    await resetBtn.click();

    // Verify publish button is visible again
    await expect(publishBtn).toBeVisible();
  });
});
