import { expect, test } from "@playwright/test";

test.describe("YouTube OAuth2 Connection E2E", () => {
  test("allows operator to connect YouTube channel and displays connected channel status", async ({
    page,
  }) => {
    let isChannelConnected = false;

    // Mock project details
    await page.route("**/projects/mock-project-id", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "mock-project-id",
          title: "OAuth Test Project",
          status: "ready_for_review",
          youtubeChannelId: isChannelConnected ? "mock-channel-id" : null,
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

    // Mock YouTube Channel connection endpoint
    await page.route(
      "**/projects/mock-project-id/youtube-channel",
      async (route) => {
        if (!isChannelConnected) {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: "null",
          });
        } else {
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
        }
      },
    );

    // Mock auth URL endpoint - redirect directly back with oauth=success
    await page.route(
      "**/youtube/auth-url?projectId=mock-project-id",
      async (route) => {
        // Set connected flag to true so when the review page re-fetches the channel, it shows as connected
        isChannelConnected = true;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            url: "/projects/mock-project-id/review?oauth=success",
          }),
        });
      },
    );

    page.on("console", (msg) =>
      console.log("BROWSER CONSOLE:", msg.text(), "at", msg.location().url),
    );
    page.on("pageerror", (err) =>
      console.log("BROWSER EXCEPTION:", err.message, err.stack),
    );

    // Navigate to project review page
    await page.goto("/projects/mock-project-id/review");

    // Check header/title is visible
    await expect(page.getByText("Revisão do Vídeo")).toBeVisible();

    // Verify YouTube channel section displays "Desconectado" initially
    await expect(page.locator("#youtube-channel-section")).toContainText(
      "Desconectado",
    );
    const connectBtn = page.locator("#connect-youtube-btn");
    await expect(connectBtn).toBeVisible();

    // Click "Conectar Canal" which redirects us (via mock url) to success page
    await connectBtn.click();

    // Verify URL redirect and query param handling occurred (clean URL without query params)
    await expect(page).toHaveURL(/projects\/mock-project-id\/review$/);

    // Verify channel shows as "Conectado" and title matches mock channel details
    await expect(page.locator("#youtube-channel-section")).toContainText(
      "Conectado",
    );
    await expect(page.locator("#youtube-channel-title")).toHaveText(
      "Mock Channel Solo Operator",
    );
  });
});
