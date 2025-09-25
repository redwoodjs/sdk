import { expect } from "vitest";
import {
  setupPlaygroundEnvironment,
  testDevAndDeploy,
  poll,
  waitForHydration,
} from "rwsdk/e2e";

setupPlaygroundEnvironment(import.meta.url);

testDevAndDeploy(
  "button is interactive while suspense is resolving",
  async ({ page, url }) => {
    await page.goto(url);

    // Helpers
    const getButton = async () => page.waitForSelector("button");
    const getButtonText = async () =>
      await page.evaluate((el) => el?.textContent, await getButton());
    const getPageContent = async () => await page.content();

    // Initial state: loading fallback is visible, button is at 0 clicks
    await poll(async () => {
      const content = await getPageContent();
      expect(content).toContain("Loading...");
      expect(await getButtonText()).toBe("Clicks: 0");
      return true;
    });

    // Wait for page to be interactive
    await waitForHydration(page);

    // Click the button and verify the count increments
    // This should happen *before* the suspense resolves
    (await getButton())?.click();

    await poll(async () => {
      const buttonText = await getButtonText();
      expect(buttonText).toBe("Clicks: 1");
      return true;
    });

    // Wait for suspense to resolve and check for final content
    await poll(
      async () => {
        const content = await getPageContent();
        // Make sure button state is preserved
        expect(await getButtonText()).toBe("Clicks: 1");
        return true;
      },
      { timeout: 5000 },
    );
  },
);
