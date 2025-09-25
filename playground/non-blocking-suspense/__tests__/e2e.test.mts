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
    // context(justinvdm, 2025-09-25): We need to use evaluate instead of page.waitForSelector
    // because the html has not been fully rendered yet when we need to interact with the button.
    const clickButton = async () =>
      await page.evaluate(() => document.querySelector("button")?.click());
    const getButtonText = async () =>
      await page.evaluate(() => document.querySelector("button")?.textContent);

    const getPageContent = async () => await page.content();

    await page.goto(url);

    // Initial state: loading fallback is visible, button is at 0 clicks
    await poll(async () => {
      expect(await getPageContent()).toContain("Loading...");
      expect(await getButtonText()).toBe("Clicks: 0");
      return true;
    });

    // Wait for page to be interactive
    await waitForHydration(page);

    await poll(async () => {
      expect(await getButtonText()).toContain("Clicks: 0");
      return true;
    });

    // Click the button and verify the count increments
    // This should happen *before* the suspense resolves
    await clickButton();

    await poll(async () => {
      const buttonText = await getButtonText();
      expect(await getButtonText()).toBe("Clicks: 1");

      console.log("############ buttonText", buttonText);
      const content = await getPageContent();
      expect(content).toContain("Loading...");
      expect(content).not.toContain("Hello from the remote request!");
      return true;
    });

    await poll(async () => {
      expect(await getButtonText()).toBe("Clicks: 1");

      const content = await getPageContent();
      expect(content).not.toContain("Loading...");
      expect(content).toContain("Hello from the remote request!");
      return true;
    });
  },
);
