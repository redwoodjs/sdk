import { describe, expect } from "vitest";
import { setupPlaygroundEnvironment, testDevAndDeploy, poll } from "rwsdk/e2e";

setupPlaygroundEnvironment(import.meta.url);

describe("Portal Freeze Issue", () => {
  testDevAndDeploy(
    "it should render the dropdown content and remain interactive",
    async ({ page, url }) => {
      await page.goto(url);
      await page.waitForSelector("h1");

      // Open the dropdown
      await page.click("button:has-text('Open Dropdown')");

      // Wait for the dropdown content to appear
      await page.waitForSelector("div:has-text('Item 1')");

      // Check if the page is interactive
      await page.waitForSelector("button:has-text('Count: 0')");
      await page.click("button:has-text('Count: 0')");
      await page.waitForSelector("button:has-text('Count: 1')");
    },
  );
});
