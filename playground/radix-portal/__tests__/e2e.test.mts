import { describe, expect } from "vitest";
import { setupPlaygroundEnvironment, testDevAndDeploy, poll } from "rwsdk/e2e";

setupPlaygroundEnvironment(import.meta.url);

describe("Portal Freeze Issue", () => {
  testDevAndDeploy(
    "it should render the portal content and remain interactive",
    async ({ page, url }) => {
      await page.goto(url);
      await page.waitForSelector("h1");

      // Wait for the portal to appear
      await poll(async () => {
        const portalText = await page.$eval("h2", (el) => {
          return el.textContent;
        });
        return portalText === "This is a portal!";
      });

      // Check if the page is interactive
      await page.waitForSelector("button:has-text('Count: 0')");
      await page.click("button:has-text('Count: 0')");
      await page.waitForSelector("button:has-text('Count: 1')");
    },
  );
});
