import { poll, setupPlaygroundEnvironment, testDevAndDeploy } from "rwsdk/e2e";
import { expect } from "vitest";

setupPlaygroundEnvironment(import.meta.url);

testDevAndDeploy("renders Hello World", async ({ page, url }) => {
  await page.goto(url);

  const getPageContent = () => page.content();

  await poll(async () => {
    const content = await getPageContent();
    expect(content).toContain("Hello World");
    return true;
  });
});

testDevAndDeploy("error handling demo is visible", async ({ page, url }) => {
  await page.goto(url);

  // Wait for page to be fully interactive
  await page.waitForFunction("document.readyState === 'complete'");

  const getErrorDemo = () => page.$("text=Error Handling Demo");

  await poll(async () => {
    const errorDemo = await getErrorDemo();
    expect(errorDemo).not.toBeNull();
    return true;
  });
});

testDevAndDeploy(
  "error handling works for uncaught errors",
  async ({ page, url }) => {
    await page.goto(url);

    // Wait for page to be fully interactive
    await page.waitForFunction("document.readyState === 'complete'");

    // Set up console error listener
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    // Wait for the error demo buttons to be available
    await page.waitForSelector("button:has-text('Trigger Uncaught Error')");

    // Click the button that triggers an uncaught error
    const button = await page.$("button:has-text('Trigger Uncaught Error')");
    expect(button).not.toBeNull();

    if (button) {
      await button.click();

      // Wait a bit for the error to be caught and logged
      await page.waitForTimeout(500);

      // Verify that the error was logged (our error handler logs to console)
      await poll(async () => {
        const hasError = consoleErrors.some((error) =>
          error.includes("Uncaught error"),
        );
        expect(hasError).toBe(true);
        return true;
      });
    }
  },
);

testDevAndDeploy(
  "error handling works for async errors",
  async ({ page, url }) => {
    await page.goto(url);

    // Wait for page to be fully interactive
    await page.waitForFunction("document.readyState === 'complete'");

    // Set up console error listener
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    // Wait for the error demo buttons to be available
    await page.waitForSelector("button:has-text('Trigger Async Error')");

    // Click the button that triggers an async error
    const button = await page.$("button:has-text('Trigger Async Error')");
    expect(button).not.toBeNull();

    if (button) {
      await button.click();

      // Wait for the async error to be caught and logged
      await page.waitForTimeout(1000);

      // Verify that the error was logged (our error handler logs to console)
      await poll(async () => {
        const hasError = consoleErrors.some((error) =>
          error.includes("Uncaught error"),
        );
        expect(hasError).toBe(true);
        return true;
      });
    }
  },
);
