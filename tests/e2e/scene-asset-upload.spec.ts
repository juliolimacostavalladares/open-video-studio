import { expect, test } from "@playwright/test";

test.describe("scene asset upload E2E", () => {
  test("allows uploading asset manually for a project and associating it with a scene", async ({
    page,
  }) => {
    const rawScript = `[CENA 1 - Cena 1]
Texto base da primeira cena.

[CENA 2 - Cena 2]
Texto base da segunda cena.`;

    const scenes = [
      {
        id: "scene-1",
        title: "Cena 1",
        script: "Texto base da primeira cena.",
        keywords: ["cena", "primeira"],
        assetId: null,
        asset: null,
      },
      {
        id: "scene-2",
        title: "Cena 2",
        script: "Texto base da segunda cena.",
        keywords: ["cena", "segunda"],
        assetId: null,
        asset: null,
      },
    ];

    const assetsList: Array<{
      id: string;
      kind: string;
      path: string;
      source: string;
      status: string;
      createdAt?: string;
    }> = [];
    let uploadCalled = false;
    let associateCalled = false;

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

    // Mock GET assets
    await page.route("**/projects/mock-project-id/assets", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ assets: assetsList }),
      });
    });

    // Mock POST upload asset and associate to scene 1 API
    await page.route(
      "**/projects/mock-project-id/scenes/scene-1/asset",
      async (route) => {
        if (route.request().method() === "POST") {
          uploadCalled = true;
          const newAsset = {
            id: "asset-1",
            kind: "image",
            path: "assets/manual/test-scene-asset.png",
            source: "upload",
            status: "ready",
            createdAt: new Date().toISOString(),
          };
          assetsList.push(newAsset);
          scenes[0].assetId = "asset-1";
          scenes[0].asset = newAsset;

          await route.fulfill({
            status: 201,
            contentType: "application/json",
            body: JSON.stringify(scenes[0]),
          });
        }
      },
    );

    // Mock PUT associate asset to scene 2 API
    await page.route(
      "**/projects/mock-project-id/scenes/scene-2/asset",
      async (route) => {
        if (route.request().method() === "PUT") {
          associateCalled = true;
          scenes[1].assetId = "asset-1";
          scenes[1].asset = {
            id: "asset-1",
            kind: "image",
            path: "assets/manual/test-scene-asset.png",
            source: "upload",
            status: "ready",
          } as never;

          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(scenes[1]),
          });
        }
      },
    );

    page.on("console", (msg) =>
      console.log("BROWSER CONSOLE:", msg.text(), "at", msg.location().url),
    );
    page.on("pageerror", (err) =>
      console.log("BROWSER EXCEPTION:", err.message, err.stack),
    );

    await page.goto("/projects/mock-project-id/edit");
    await page.getByRole("button", { name: "Mídias", exact: true }).click();

    // Check header is visible
    await expect(page.locator(".edit-tool-drawer h2")).toContainText("Mídias");

    // Perform file upload simulation (associating to default active Scene 1)
    await page
      .locator('input[type="file"]')
      .first()
      .setInputFiles({
        name: "test-scene-asset.png",
        mimeType: "image/png",
        buffer: Buffer.from("fake-png-binary-data"),
      });

    // Verify upload and auto-associate succeeded
    await expect(
      page.getByText("Mídia enviada e associada com sucesso!"),
    ).toBeVisible();
    expect(uploadCalled).toBe(true);

    // Now select Scene 2 on the visual timeline
    await page.locator(".timeline-visual-block").nth(1).click();

    // Click on the asset card in the library grid to associate with the newly active Scene 2
    await page.locator(".group.relative.rounded-xl").first().click();

    // Verify association API was called and the success message is shown
    await expect(page.getByText("Mídia associada com sucesso!")).toBeVisible();
    expect(associateCalled).toBe(true);

    // Verify timeline clip contains the image preview attribute
    await expect(
      page.locator(".timeline-visual-block img").first(),
    ).toHaveAttribute("src", /.*test-scene-asset\.png$/);
  });
});
