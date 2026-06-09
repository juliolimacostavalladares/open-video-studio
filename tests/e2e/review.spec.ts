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

  test("allows editing project metadata (title, description, tags) with validation and persistence", async ({
    page,
  }) => {
    // Intercept mock GET /renders so video player works
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

    let patchPayload: {
      title?: string;
      description?: string | null;
      tags?: string[];
    } | null = null;
    // Intercept PATCH request to verify details sent to the backend
    await page.route("**/projects/mock-project-id", async (route) => {
      if (route.request().method() === "PATCH") {
        patchPayload = route.request().postDataJSON() as typeof patchPayload;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          headers: { "Access-Control-Allow-Origin": "*" },
          body: JSON.stringify({
            id: "mock-project-id",
            title: patchPayload?.title,
            description: patchPayload?.description,
            rawScript: "[CENA 1]\nTexto de teste para a cena.",
            status: "ready_for_review",
            voiceProfileId: "voice-id",
            estimatedDuration: 15,
            tags: patchPayload?.tags || [],
          }),
        });
      } else {
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
      }
    });

    await page.goto("/projects/mock-project-id/review");

    // 1. Validate initial form values
    const titleInput = page.locator("#metadata-title-input");
    const descInput = page.locator("#metadata-description-input");
    const tagsInput = page.locator("#metadata-tags-input");

    await expect(titleInput).toHaveValue("Review E2E Project");
    await expect(descInput).toHaveValue(
      "This is a test project description for E2E review.",
    );
    await expect(tagsInput).toHaveValue("");

    // 2. Test title validation (empty title)
    await titleInput.fill("");
    await page.locator("#save-metadata-btn").click();
    await expect(
      page.locator("#metadata-validation-error-title"),
    ).toContainText("O título não pode ser vazio");

    // 3. Test tag validation (invalid characters)
    await titleInput.fill("Novo Título");
    await tagsInput.fill("invalido@tag");
    await page.locator("#save-metadata-btn").click();
    await expect(page.locator("#metadata-validation-error-tags")).toContainText(
      "As tags devem conter apenas letras, números, espaços ou hífens/sublinhados",
    );

    // 4. Fill valid metadata and save
    await tagsInput.fill("tecnologia, ts-review, e2e_test");
    await page.locator("#save-metadata-btn").click();

    // Verify success banner and updated values
    await expect(page.locator("#metadata-save-success")).toContainText(
      "Metadados salvos com sucesso!",
    );

    // Verify PATCH was called with clean, parsed inputs
    expect(patchPayload).not.toBeNull();
    expect(patchPayload?.title).toBe("Novo Título");
    expect(patchPayload?.description).toBe(
      "This is a test project description for E2E review.",
    );
    expect(patchPayload?.tags).toEqual(["tecnologia", "ts-review", "e2e_test"]);

    // Verify title in header was dynamically updated
    await expect(page.locator("header")).toContainText("Novo Título");
  });

  test("supports approval, rejection, and invalidation of approval when modified", async ({
    page,
  }) => {
    // Intercept mock GET /renders so video player works
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

    // We store the current project state so we can simulate the API updates dynamically
    let projectState = {
      id: "mock-project-id",
      title: "Review E2E Project",
      description: "This is a test project description for E2E review.",
      rawScript: "[CENA 1]\nTexto de teste para a cena.",
      status: "ready_for_review",
      voiceProfileId: "voice-id",
      estimatedDuration: 15,
      tags: [] as string[],
    };

    // Route projects/mock-project-id requests dynamically based on state
    await page.route("**/projects/mock-project-id", async (route) => {
      const method = route.request().method();
      if (method === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          headers: { "Access-Control-Allow-Origin": "*" },
          body: JSON.stringify(projectState),
        });
      } else if (method === "PATCH") {
        const payload = route.request().postDataJSON() as {
          title?: string;
          description?: string | null;
          tags?: string[];
        };

        let changed = false;
        if (payload.title !== undefined && payload.title !== projectState.title)
          changed = true;
        if (
          payload.description !== undefined &&
          payload.description !== projectState.description
        )
          changed = true;

        projectState = {
          ...projectState,
          title:
            payload.title !== undefined ? payload.title : projectState.title,
          description:
            payload.description !== undefined
              ? payload.description
              : projectState.description,
          tags: payload.tags !== undefined ? payload.tags : projectState.tags,
          status:
            changed && projectState.status === "approved"
              ? "ready_for_review"
              : projectState.status,
        };

        await route.fulfill({
          status: 200,
          contentType: "application/json",
          headers: { "Access-Control-Allow-Origin": "*" },
          body: JSON.stringify(projectState),
        });
      } else {
        await route.continue();
      }
    });

    // Intercept approve endpoint
    await page.route("**/projects/mock-project-id/approve", async (route) => {
      projectState.status = "approved";
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify(projectState),
      });
    });

    // Intercept reject endpoint
    await page.route("**/projects/mock-project-id/reject", async (route) => {
      projectState.status = "rejected";
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify(projectState),
      });
    });

    await page.goto("/projects/mock-project-id/review");

    // 1. Initial status verify
    await expect(page.locator("#review-status-label")).toContainText(
      "Pronto para Revisão",
    );
    await expect(page.locator("#ready-for-review-state")).toContainText(
      "Pronto para revisão!",
    );

    // 2. Reject the project
    const rejectBtn = page.locator("#reject-project-btn");
    await rejectBtn.click();
    await expect(page.locator("#review-status-label")).toContainText(
      "Rejeitado",
    );
    await expect(page.locator("#ready-for-review-state")).toContainText(
      "Projeto rejeitado",
    );
    await expect(rejectBtn).toBeDisabled();

    // 3. Approve the project
    const approveBtn = page.locator("#approve-project-btn");
    await approveBtn.click();
    await expect(page.locator("#review-status-label")).toContainText(
      "Aprovado",
    );
    await expect(page.locator("#ready-for-review-state")).toContainText(
      "Projeto aprovado com sucesso",
    );
    await expect(approveBtn).toBeDisabled();

    // 4. Invalidation: Make a metadata change and save
    const titleInput = page.locator("#metadata-title-input");
    await titleInput.fill("New Title to Invalidate Approval");
    await page.locator("#save-metadata-btn").click();

    // Verify it reverted to ready_for_review
    await expect(page.locator("#review-status-label")).toContainText(
      "Pronto para Revisão",
    );
    await expect(page.locator("#ready-for-review-state")).toContainText(
      "Pronto para revisão!",
    );
  });
});
