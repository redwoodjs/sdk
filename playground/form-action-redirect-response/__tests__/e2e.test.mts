import { expect } from "vitest";
import {
  setupPlaygroundEnvironment,
  testDevAndDeploy,
  poll,
  waitForHydration,
} from "rwsdk/e2e";

setupPlaygroundEnvironment(import.meta.url);

testDevAndDeploy(
  "server action returning 303 Response navigates to Location",
  async ({ page, url }) => {
    await page.goto(url);
    await waitForHydration(page);

    const getNameInput = () => page.waitForSelector("#name");
    const getSubmitButton = () => page.waitForSelector('button[type="submit"]');

    // Fill name to trigger the redirect Response branch
    await (await getNameInput())?.type("Alice");
    await (await getSubmitButton())?.click();

    // Expect client-side navigation to /test
    await poll(async () => {
      const currentUrl = page.url();
      if (!currentUrl.endsWith("/test")) return false;
      const content = await page.content();
      expect(content).toContain("You are on the /test page");
      return true;
    });
  },
);

