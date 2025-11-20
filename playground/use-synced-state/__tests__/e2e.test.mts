import {
  poll,
  setupPlaygroundEnvironment,
  testDevAndDeploy,
  waitForHydration,
} from "rwsdk/e2e";
import { expect } from "vitest";

setupPlaygroundEnvironment(import.meta.url);

testDevAndDeploy(
  "counter persists across page reload",
  async ({ page, url }) => {
    // Navigate to the page
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await waitForHydration(page);

    // Helper function to get the current count
    const getCount = async () => {
      // Wait for the counter display element
      await page.waitForSelector(".counter-display");
      // Get the text content and extract the count
      const text = await page.$eval(".counter-display", (el) => el.textContent);
      const match = text?.match(/Count:\s*(\d+)/);
      return parseInt(match?.[1] || "0", 10);
    };

    // Verify initial state - counter should start at 0
    await poll(async () => {
      const count = await getCount();
      expect(count).toBe(0);
      return true;
    });

    // Click increment button (first button in button-group is Increment)
    await page.waitForSelector(".button-group button");
    await page.click(".button-group button:first-child");

    // Verify counter updated to 1
    await poll(async () => {
      const count = await getCount();
      expect(count).toBe(1);
      return true;
    });

    // Reload the page
    await page.reload({ waitUntil: "domcontentloaded", timeout: 30000 });
    await waitForHydration(page);

    // Verify counter persisted - should still be 1
    await poll(async () => {
      const count = await getCount();
      expect(count).toBe(1);
      return true;
    });
  },
);

// Figure out how to test multiple browsers connect to the same page and both receiving the same update.
