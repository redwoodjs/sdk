import {
  PUPPETEER_TIMEOUT,
  poll,
  setupPlaygroundEnvironment,
  testDevAndDeploy,
  waitForHydration,
} from "rwsdk/e2e";
import { expect } from "vitest";

setupPlaygroundEnvironment(import.meta.url);

testDevAndDeploy(
  "counter persists across page reload",
  async ({ page, url, browser }) => {
    // Navigate to the page
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await waitForHydration(page);

    // Helper function to get the current count from the Global Counter (second counter on page)
    const getCount = async () => {
      // Wait for all counter displays
      await page.waitForSelector(".counter-display");
      // Get the second counter display (Global Counter)
      const text = await page.$$eval(
        ".counter-display",
        (els) => els[1]?.textContent,
      );
      const match = text?.match(/Count:\s*(\d+)/);
      return parseInt(match?.[1] || "0", 10);
    };

    // Verify initial state - counter should start at 0
    await poll(async () => {
      const count = await getCount();
      expect(count).toBe(0);
      return true;
    });

    // Click increment button on the Global Counter (second button-group)
    await page.waitForSelector(".button-group button");
    // Get all button groups and click the first button of the second group (Global Counter)
    await page.evaluate(() => {
      const buttonGroups = document.querySelectorAll(".button-group");
      const globalCounterButtonGroup = buttonGroups[1];
      const incrementButton = globalCounterButtonGroup?.querySelector("button");
      incrementButton?.click();
    });

    // Verify counter updated to 1
    await poll(async () => {
      const count = await getCount();
      expect(count).toBe(1);
      return true;
    });

    // context(chrsnymn, 21 Nov 2026): The local count changes before the
    // server receives it. Confirm another browser received the update first.
    const observerContext = await browser.createBrowserContext();
    try {
      const observer = await observerContext.newPage();
      observer.setDefaultTimeout(PUPPETEER_TIMEOUT);
      await observer.goto(url);
      await waitForHydration(observer);
      await observer.waitForFunction(
        () =>
          document.querySelectorAll(".counter-display")[1]?.textContent ===
          "Count: 1",
      );
    } finally {
      await observerContext.close();
    }

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
