import { describe, expect } from "vitest";
import { setupPlaygroundEnvironment, testDevAndDeploy, poll } from "rwsdk/e2e";

setupPlaygroundEnvironment(import.meta.url);

describe("Form + Portal Bug", () => {
  testDevAndDeploy(
    "it should remain interactive when a portal is rendered inside a div",
    async ({ page, url }) => {
      await page.goto(`${url}/working`);
      await page.waitForSelector("h1");

      // Set up a listener for the alert
      let alertMessage = "";
      page.on("dialog", async (dialog) => {
        alertMessage = dialog.message();
        await dialog.accept();
      });

      // Click the button that triggers the alert
      await page.click("button:has-text('Test Interactivity')");

      // Check that the alert was shown
      expect(alertMessage).toBe("Page is interactive!");

      // Now open the portal and test interactivity again
      await page.click("button:has-text('Show Portal')");
      await page.waitForSelector("h2:has-text('This is a portal!')");

      await page.click("button:has-text('Test Interactivity')");
      expect(alertMessage).toBe("Page is interactive!");
    },
  );

  testDevAndDeploy(
    "it should freeze when a portal is rendered inside a form",
    async ({ page, url }) => {
      await page.goto(`${url}/broken`);
      await page.waitForSelector("h1");

      // This click will trigger the portal and freeze the page
      await page.click("button:has-text('Show Portal (Will Freeze)')");
      await page.waitForSelector("h2:has-text('This is a portal!')");

      // The following action should time out if the page is frozen.
      // We'll set a short timeout to fail the test quickly.
      const interactivityCheck = page.click(
        "button:has-text('Test Interactivity')",
        { timeout: 2000 },
      );

      await expect(interactivityCheck).rejects.toThrow(
        /Timeout 2000ms exceeded/,
      );
    },
  );
});
