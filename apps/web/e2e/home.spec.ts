import { test, expect } from '@playwright/test';

test.describe('Next.js Home Page E2E Tests', () => {
  test('should navigate to the home page and verify main elements', async ({
    page,
  }) => {
    // Navigate to the baseURL
    await page.goto('/');

    // Verify page title
    await expect(page).toHaveTitle(/Create Next App/);

    // Verify presence of Next.js logo
    const logo = page.locator('img[alt="Next.js logo"]');
    await expect(logo).toBeVisible();

    // Verify that the getting started instructions are present
    const instructions = page.locator('ol');
    await expect(instructions).toContainText('Get started by editing');

    // Verify action links
    const docsLink = page.locator('a:has-text("Read our docs")');
    await expect(docsLink).toBeVisible();
    await expect(docsLink).toHaveAttribute('href', /nextjs.org\/docs/);
  });
});
