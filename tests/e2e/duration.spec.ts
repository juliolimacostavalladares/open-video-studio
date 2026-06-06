import { expect, test } from "@playwright/test";

import { prisma } from "../../packages/database/src/client.js";

test.describe("estimated duration E2E", () => {
  let projectId: string;

  test.beforeAll(async () => {
    // Cria um projeto de teste no banco
    const project = await prisma.project.create({
      data: {
        title: "E2E Duration Test Project",
        status: "draft",
        rawScript: ""
      }
    });
    projectId = project.id;
  });

  test.afterAll(async () => {
    if (projectId) {
      await prisma.project.delete({ where: { id: projectId } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  test("calculates and updates estimated duration in real time as the user edits the script", async ({ page }) => {
    await page.goto(`/projects/${projectId}/edit`);

    // Duração inicial deve ser 0s
    const durationBadge = page.locator("#estimated-duration");
    await expect(durationBadge).toContainText("0s");

    // Edita o roteiro para conter 140 palavras faladas (+ marcadores)
    const editor = page.locator("#script-editor");
    const spokenText = Array(140).fill("word").join(" ");
    const script = `[CENA 1 - Intro]\n${spokenText}\n[CENA 2]`;

    await editor.fill(script);

    // O cálculo de duração estimada (140 palavras a 140 PPM média = 60s) deve atualizar na hora
    await expect(durationBadge).toContainText("1m 0s");
    await expect(durationBadge).toContainText("56s - 1m 5s");
  });
});
