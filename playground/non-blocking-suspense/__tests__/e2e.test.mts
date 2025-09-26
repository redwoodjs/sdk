import { expect } from "vitest";
import { setupPlaygroundEnvironment, testDevAndDeploy, poll } from "rwsdk/e2e";

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

    page.goto(url);

    // Initial state: loading fallback is visible, button is at 0 clicks
    await poll(async () => {
      const content = await getPageContent();
      expect(await getPageContent()).toContain("Loading...");
      expect(await getButtonText()).toBe("Clicks: 0");
      return true;
    });

    await poll(async () => {
      expect(await getButtonText()).toContain("Clicks: 0");
      return true;
    });

    await poll(async () => {
      await clickButton();
      const buttonText = await getButtonText();
      expect(await getButtonText()).toBe("Clicks: 1");

      expect(await getPageContent()).not.toContain(
        "Hello from the remote request!",
      );
      return true;
    });

    await poll(async () => {
      expect(await getPageContent()).toContain(
        "Hello from the remote request!",
      );
      return true;
    });
  },
);

testDevAndDeploy(
  "button is interactive while suspense is resolving with renderToStream",
  async ({ page, url }) => {
    // context(justinvdm, 2025-09-25): We need to use evaluate instead of page.waitForSelector
    // because the html has not been fully rendered yet when we need to interact with the button.
    const clickButton = async () =>
      await page.evaluate(() => document.querySelector("button")?.click());
    const getButtonText = async () =>
      await page.evaluate(() => document.querySelector("button")?.textContent);

    const getPageContent = async () => await page.content();

    page.goto(`${url}/render-to-stream`);

    // Initial state: loading fallback is visible, button is at 0 clicks
    await poll(async () => {
      const content = await getPageContent();
      expect(await getPageContent()).toContain("Loading...");
      expect(await getButtonText()).toBe("Clicks: 0");
      return true;
    });

    await poll(async () => {
      expect(await getButtonText()).toContain("Clicks: 0");
      return true;
    });

    await poll(async () => {
      await clickButton();
      const buttonText = await getButtonText();
      expect(await getButtonText()).toBe("Clicks: 1");

      expect(await getPageContent()).not.toContain(
        "Hello from the remote request!",
      );
      return true;
    });

    await poll(async () => {
      expect(await getPageContent()).toContain(
        "Hello from the remote request!",
      );
      return true;
    });
  },
);
