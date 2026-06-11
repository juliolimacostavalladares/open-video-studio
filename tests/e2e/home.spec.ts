import { expect, test } from "@playwright/test";

test("renders the SaaS workspace dashboard", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: "Transforme ideias em vídeos prontos para publicar.",
    }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Novo vídeo" })).toBeVisible();
});
