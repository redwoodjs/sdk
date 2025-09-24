import { describe, expect } from "vitest";
import { setupPlaygroundEnvironment, testDevAndDeploy, poll } from "rwsdk/e2e";

setupPlaygroundEnvironment(import.meta.url);

describe("Portal Freeze Issue", () => {
  testDevAndDeploy(
    "it should render the dropdown content and remain interactive after a server action",
    async ({ page, url }) => {
      await page.goto(url);
      await page.waitForSelector("h1");

      // Open the dropdown
      await page.click("button:has-text('Open Dropdown')");

      // Wait for the dropdown content to appear
      await page.waitForSelector("div:has-text('Item 1')");

      // Trigger the server action
      await page.click("button:has-text('Trigger Action')");

      // Check if the page is interactive by clicking the counter
      await page.waitForSelector("button:has-text('Count: 0')");
      await page.click("button:has-text('Count: 0')");
      await page.waitForSelector("button:has-text('Count: 1')");
    },
  );
});
