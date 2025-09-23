import { expect } from "vitest";
import { setupPlaygroundEnvironment, testDevAndDeploy } from "rwsdk/e2e";

setupPlaygroundEnvironment(import.meta.url);

testDevAndDeploy(
  "handles client module exports from within the app",
  async ({ page, url }) => {
    // Collect console errors
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto(url);

    // 1. Check for server-rendered content from the utility function
    const localMessageEl = await page.waitForSelector(
      '[data-testid="local-message"]',
    );
    const localMessage = await localMessageEl?.evaluate((el) => el.textContent);
    expect(localMessage).toBe("Hello, World from a client util!");

    // 2. Check that the client component is rendered and interactive
    const button = await page.waitForSelector("button");
    let buttonText = await button?.evaluate((el) => el.textContent);
    expect(buttonText).toContain("App Button (Clicks: 0)");

    await button?.click();
    buttonText = await button?.evaluate((el) => el.textContent);
    expect(buttonText).toContain("App Button (Clicks: 1)");

    // 3. Assert that no hydration errors occurred
    expect(consoleErrors).toEqual([]);
  },
);

testDevAndDeploy.skip(
  "handles client module exports from within a package",
  async ({ page, url }) => {
    // Collect console errors
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto(url);

    // 1. Check for server-rendered content from the utility function
    const packageMessageEl = await page.waitForSelector(
      '[data-testid="package-message"]',
    );
    const packageMessage = await packageMessageEl?.evaluate(
      (el) => el.textContent,
    );
    expect(packageMessage).toBe("Hello, World from a package util!");

    // 2. Check that the client component is rendered and interactive
    const button = await page.waitForSelector("button");
    let buttonText = await button?.evaluate((el) => el.textContent);
    expect(buttonText).toContain("Package Button (Clicks: 0)");

    await button?.click();
    buttonText = await button?.evaluate((el) => el.textContent);
    expect(buttonText).toContain("Package Button (Clicks: 1)");

    // 3. Assert that no hydration errors occurred
    expect(consoleErrors).toEqual([]);
  },
);
