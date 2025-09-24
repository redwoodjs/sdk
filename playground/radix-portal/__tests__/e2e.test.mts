import { describe, expect } from "vitest";
import { setupPlaygroundEnvironment, testDevAndDeploy, poll } from "rwsdk/e2e";

setupPlaygroundEnvironment(import.meta.url);

describe("Portal Freeze Issue", () => {
  testDevAndDeploy(
    "it should remain interactive on the Direct React Portal page",
    async ({ page, url }) => {
      await page.goto(`${url}/direct-react-portal`);
      await page.waitForSelector("h1");

      await page.click("button:has-text('Show Portal')");
      await page.waitForSelector(
        'h2:has-text("This is a direct React portal!")',
      );

      await page.click("button:has-text('Trigger Action')");

      await page.waitForSelector("button:has-text('Count: 0')");
      await page.click("button:has-text('Count: 0')");
      await page.waitForSelector("button:has-text('Count: 1')");
    },
  );

  testDevAndDeploy(
    "it should remain interactive on the Radix Portal page",
    async ({ page, url }) => {
      await page.goto(`${url}/radix-portal`);
      await page.waitForSelector("h1");

      await page.click("button:has-text('Show Portal')");
      await page.waitForSelector('h2:has-text("This is a Radix portal!")');

      await page.click("button:has-text('Trigger Action')");

      await page.waitForSelector("button:has-text('Count: 0')");
      await page.click("button:has-text('Count: 0')");
      await page.waitForSelector("button:has-text('Count: 1')");
    },
  );

  testDevAndDeploy(
    "it should freeze on the Dropdown page",
    async ({ page, url }) => {
      await page.goto(`${url}/dropdown`);
      await page.waitForSelector("h1");

      await page.click("button:has-text('Open Dropdown')");
      await page.waitForSelector("div:has-text('Item 1')");

      await page.click("button:has-text('Trigger Action')");

      // This part is expected to time out and fail if the page freezes
      await page.waitForSelector("button:has-text('Count: 0')");
      await page.click("button:has-text('Count: 0')");
      await page.waitForSelector("button:has-text('Count: 1')");
    },
  );
});
