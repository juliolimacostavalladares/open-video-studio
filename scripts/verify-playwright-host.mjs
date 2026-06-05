import { chromium } from "@playwright/test";

let browser;

try {
  browser = await chromium.launch({
    headless: true
  });

  const page = await browser.newPage();
  await page.setContent("<html><body><h1>playwright-host-ok</h1></body></html>");
  await page.getByText("playwright-host-ok").waitFor();
  console.log("Playwright host runtime is ready.");
} finally {
  await browser?.close();
}
