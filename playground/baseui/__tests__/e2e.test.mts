import { expect } from "vitest";
import {
  setupPlaygroundEnvironment,
  testDevAndDeploy,
  poll,
  waitForHydration,
} from "rwsdk/e2e";

setupPlaygroundEnvironment(import.meta.url);

testDevAndDeploy(
  "renders Base UI playground without errors",
  async ({ page, url }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto(url, { waitUntil: "networkidle0" });

    const getElementText = (selector: string) =>
      page.$eval(selector, (el) => el.textContent);

    await poll(async () => {
      const mainTitle = await getElementText('[data-testid="main-title"]');
      expect(mainTitle).toContain("Base UI Playground");

      const subtitle = await getElementText('[data-testid="subtitle"]');
      expect(subtitle).toContain("A simple component showcase for RedwoodSDK");
      return true;
    });

    expect(consoleErrors).toEqual([]);
  },
);

testDevAndDeploy(
  "interactive components work correctly",
  async ({ page, url }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto(url, { waitUntil: "networkidle0" });
    await page.waitForSelector('[data-testid="main-title"]');

    await waitForHydration(page);

    // Test accordion
    const accordionTrigger = await page.waitForSelector(
      '[data-testid="accordion"] button',
    );
    await accordionTrigger?.click();
    await poll(async () => {
      const content = await page.content();
      return content.includes("Base UI is a library of headless UI components");
    });

    // Test dialog
    const dialogTrigger = await page.waitForSelector(
      '[data-testid="dialog-trigger"]',
    );
    await dialogTrigger?.click();
    await poll(async () => {
      return await page.$eval(
        '[data-testid="dialog"]',
        (el) => !!el && el.checkVisibility(),
      );
    });

    // Test switch
    const switchComponent = await page.waitForSelector(
      '[data-testid="switch"]',
    );
    await switchComponent?.click();

    expect(consoleErrors).toEqual([]);
  },
);
