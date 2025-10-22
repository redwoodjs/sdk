import {
  poll,
  setupPlaygroundEnvironment,
  testDevAndDeploy,
  waitForHydration,
} from "rwsdk/e2e";
import { expect } from "vitest";

setupPlaygroundEnvironment(import.meta.url);

testDevAndDeploy(
  "renders Mantine playground without errors",
  async ({ page, url }) => {
    await page.goto(url, { waitUntil: "networkidle0" });

    const getElementText = (selector: string) =>
      page.$eval(selector, (el) => el.textContent);

    await poll(async () => {
      const mainTitle = await getElementText('[data-testid="main-title"]');
      expect(mainTitle).toContain("Mantine Playground");

      const subtitle = await getElementText('[data-testid="subtitle"]');
      expect(subtitle).toContain("A simple component showcase for RedwoodSDK");
      return true;
    });
  },
);

testDevAndDeploy(
  "interactive components work correctly",
  async ({ page, url }) => {
    await page.goto(url, { waitUntil: "networkidle0" });
    await page.waitForSelector('[data-testid="main-title"]');

    await waitForHydration(page);

    // Test accordion
    const accordionTrigger = await page.waitForSelector(
      '[data-testid="accordion-section"] button',
    );
    await accordionTrigger?.click();
    await poll(async () => {
      const content = await page.content();
      return content.includes(
        "Colors, fonts, shadows and many other parts are customizable to fit your design needs",
      );
    });

    // Test dialog
    const dialogTrigger = await page.waitForSelector(
      '[data-testid="dialog-section"] button',
    );
    await dialogTrigger?.click();
    await poll(async () => {
      return await page.$eval(
        '[role="dialog"]',
        (el) => !!el && el.checkVisibility(),
      );
    });

    // Test switch
    const switchComponent = await page.waitForSelector('[role="switch"]');
    await switchComponent?.click();
  },
);
