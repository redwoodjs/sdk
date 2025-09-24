import { describe, expect } from "vitest";
import { setupPlaygroundEnvironment, testDevAndDeploy } from "rwsdk/e2e";

setupPlaygroundEnvironment(import.meta.url);

describe("Form + Portal Bug", () => {
  testDevAndDeploy(
    "it should freeze when a portal is rendered inside a form",
    async ({ page, url }) => {
      await page.goto(url);
      await page.waitForSelector("h1");

      // Check initial state
      await page.waitForSelector("button:has-text('Count: 0')");

      // This click will trigger the portal and should freeze the page
      await page.click("button:has-text('Show Portal (Will Freeze)')");
      await page.waitForSelector("h2:has-text('This is a portal!')");

      // The following action should time out if the page is frozen.
      const interactivityCheck = page.click("button:has-text('Count: 0')", {
        timeout: 2000,
      });

      await expect(interactivityCheck).rejects.toThrow(
        /Timeout 2000ms exceeded/,
      );
    },
  );
});
