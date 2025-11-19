import {
  poll,
  setupPlaygroundEnvironment,
  testDevAndDeploy,
  waitForHydration,
} from "rwsdk/e2e";
import { expect } from "vitest";

setupPlaygroundEnvironment(import.meta.url);

testDevAndDeploy(
  "syncs state across multiple browser contexts",
  async ({ page, url, browser }) => {
    await page.goto(url);
    await waitForHydration(page);

    // Helper functions
    const getCount = async () => {
      const countEl = await page.waitForSelector("text=Count:");
      const text = await countEl?.textContent();
      const match = text?.match(/Count:\s*(\d+)/);
      return parseInt(match?.[1] || "0", 10);
    };

    const getIncrementButton = () =>
      page.waitForSelector('button:has-text("Increment")');

    const getResetButton = () =>
      page.waitForSelector('button:has-text("Reset")');

    const getMessageInput = () =>
      page.waitForSelector('input[type="text"][placeholder*="message"]');

    const getMessageDisplay = async () => {
      const messageEl = await page.waitForSelector(".message-display");
      const text = await messageEl?.textContent();
      return text?.trim() || "";
    };

    // Test initial state - counter should start at 0
    await poll(async () => {
      const count = await getCount();
      expect(count).toBe(0);
      return true;
    });

    // Test state update in first context - increment counter
    (await getIncrementButton())?.click();

    await poll(async () => {
      const count = await getCount();
      expect(count).toBe(1);
      return true;
    });

    // Create second browser page (simulating another tab)
    const page2 = await browser.newPage();
    await page2.goto(url);
    await waitForHydration(page2);

    // Helper functions for page2
    const getCount2 = async () => {
      const countEl = await page2.waitForSelector("text=Count:");
      const text = await countEl?.textContent();
      const match = text?.match(/Count:\s*(\d+)/);
      return parseInt(match?.[1] || "0", 10);
    };

    const getIncrementButton2 = () =>
      page2.waitForSelector('button:has-text("Increment")');

    const getMessageInput2 = () =>
      page2.waitForSelector('input[type="text"][placeholder*="message"]');

    const getMessageDisplay2 = async () => {
      const messageEl = await page2.waitForSelector(".message-display");
      const text = await messageEl?.textContent();
      return text?.trim() || "";
    };

    // Verify second context sees the synced state (count should be 1)
    await poll(async () => {
      const count2 = await getCount2();
      expect(count2).toBe(1);
      return true;
    });

    // Increment from second context
    (await getIncrementButton2())?.click();

    // Both contexts should see the update
    await poll(async () => {
      const count = await getCount();
      const count2 = await getCount2();
      expect(count).toBe(2);
      expect(count2).toBe(2);
      return true;
    });

    // Test multiple keys - update message from first context
    const messageInput = await getMessageInput();
    await messageInput?.click({ clickCount: 3 }); // Select all
    await messageInput?.type("Hello from page 1");

    await poll(async () => {
      const message = await getMessageDisplay();
      expect(message).toBe("Hello from page 1");
      return true;
    });

    // Second context should see the message update
    await poll(async () => {
      const message2 = await getMessageDisplay2();
      expect(message2).toBe("Hello from page 1");
      return true;
    });

    // Update message from second context
    const messageInput2 = await getMessageInput2();
    await messageInput2?.click({ clickCount: 3 }); // Select all
    await messageInput2?.type("Hello from page 2");

    // Both contexts should see the updated message
    await poll(async () => {
      const message = await getMessageDisplay();
      const message2 = await getMessageDisplay2();
      expect(message).toBe("Hello from page 2");
      expect(message2).toBe("Hello from page 2");
      return true;
    });

    // Verify counter and message are independent - counter should still be 2
    await poll(async () => {
      const count = await getCount();
      const count2 = await getCount2();
      expect(count).toBe(2);
      expect(count2).toBe(2);
      return true;
    });

    // Reset counter from first context
    (await getResetButton())?.click();

    // Both contexts should see counter reset to 0, but message should remain
    await poll(async () => {
      const count = await getCount();
      const count2 = await getCount2();
      const message = await getMessageDisplay();
      expect(count).toBe(0);
      expect(count2).toBe(0);
      expect(message).toBe("Hello from page 2");
      return true;
    });

    await page2.close();
  },
);

