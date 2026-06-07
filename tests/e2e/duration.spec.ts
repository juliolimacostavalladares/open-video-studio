import { expect, test } from "@playwright/test";

test.describe("estimated duration E2E", () => {
  test("calculates and updates estimated duration in real time as the user edits the script", async ({
    page,
  }) => {
    // Intercepta a chamada GET do projeto para retornar dados fictícios sem precisar de banco
    await page.route("**/projects/mock-project-id", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "mock-project-id",
          title: "E2E Duration Test Project",
          rawScript: "",
          status: "draft",
          updatedAt: new Date().toISOString(),
          estimatedDuration: 0,
          estimatedDurationMin: 0,
          estimatedDurationMax: 0,
        }),
      });
    });

    // Intercepta a chamada PATCH de autosave do editor
    await page.route("**/projects/mock-project-id/script", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "mock-project-id",
          title: "E2E Duration Test Project",
          rawScript: "salvo",
          status: "scripting",
          updatedAt: new Date().toISOString(),
          estimatedDuration: 0,
          estimatedDurationMin: 0,
          estimatedDurationMax: 0,
        }),
      });
    });

    await page.goto("/projects/mock-project-id/edit");

    // Duração inicial deve ser 0s
    const durationBadge = page.locator("#estimated-duration");
    await expect(durationBadge).toContainText("0s");

    // Edita o roteiro para conter 140 palavras faladas (+ marcadores)
    const editor = page.locator("#script-editor");

    // Aguarda a hidratação do editor concluir
    await expect(editor).toHaveAttribute("aria-busy", "false", {
      timeout: 15_000,
    });

    const spokenText = Array(140).fill("word").join(" ");
    const script = `[CENA 1 - Intro]\n${spokenText}\n[CENA 2]`;

    await editor.fill(script);

    // O cálculo de duração estimada (140 palavras a 140 PPM média = 60s) deve atualizar na hora
    await expect(durationBadge).toContainText("1m 0s");
    await expect(durationBadge).toContainText("56s - 1m 5s");
  });
});
