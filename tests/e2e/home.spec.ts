import { expect, test } from "@playwright/test";

test("renders the base workspace screen", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Open Video Studio" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Novo Projeto" })).toBeVisible();
});
