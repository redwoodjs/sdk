import { expect } from "vitest";
import {
  setupPlaygroundEnvironment,
  testDevAndDeploy,
  poll,
  waitForHydration,
} from "rwsdk/e2e";

setupPlaygroundEnvironment(import.meta.url);

testDevAndDeploy("form action returns redirect Response and navigates", async ({ page, url }) => {
  await page.goto(url);
  await waitForHydration(page);

  // Submit the form
  const submit = await page.waitForSelector('button[type="submit"]');
  await submit?.click();

  // Expect navigation to /test and content from Test page
  await poll(async () => {
    const currentUrl = page.url();
    if (!currentUrl.endsWith("/test")) return false;
    const content = await page.content();
    expect(content).toContain("Test redirect response");
    return true;
  });
});

