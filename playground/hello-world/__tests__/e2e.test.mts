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
    // Set up console error listener BEFORE navigation
    const consoleErrorPromise = new Promise<string>((resolve) => {
      const handler = (msg: any) => {
        if (msg.type() === "error" && msg.text().includes("Uncaught error")) {
          page.off("console", handler);
          resolve(msg.text());
        }
      };
      page.on("console", handler);
    });

    await page.goto(url);

    // Wait for page to be fully interactive
    await page.waitForFunction("document.readyState === 'complete'");

    // Wait for the error demo buttons to be available
    await page.waitForSelector("button:has-text('Trigger Uncaught Error')");

    // Click the button that triggers an uncaught error
    const button = await page.$("button:has-text('Trigger Uncaught Error')");
    expect(button).not.toBeNull();

    if (button) {
      await button.click();

      // Wait for the error message to appear in console
      const errorMessage = await Promise.race([
        consoleErrorPromise,
        new Promise<string>((_, reject) =>
          setTimeout(() => reject(new Error("Timeout waiting for error")), 5000),
        ),
      ]);

      expect(errorMessage).toContain("Uncaught error");
    }
  },
);

testDevAndDeploy(
  "error handling works for async errors",
  async ({ page, url }) => {
    // Set up console error listener BEFORE navigation
    const consoleErrorPromise = new Promise<string>((resolve) => {
      const handler = (msg: any) => {
        if (msg.type() === "error" && msg.text().includes("Uncaught error")) {
          page.off("console", handler);
          resolve(msg.text());
        }
      };
      page.on("console", handler);
    });

    await page.goto(url);

    // Wait for page to be fully interactive
    await page.waitForFunction("document.readyState === 'complete'");

    // Wait for the error demo buttons to be available
    await page.waitForSelector("button:has-text('Trigger Async Error')");

    // Click the button that triggers an async error
    const button = await page.$("button:has-text('Trigger Async Error')");
    expect(button).not.toBeNull();

    if (button) {
      await button.click();

      // Wait for the async error message to appear in console
      // Async errors happen after a setTimeout, so we need to wait longer
      const errorMessage = await Promise.race([
        consoleErrorPromise,
        new Promise<string>((_, reject) =>
          setTimeout(() => reject(new Error("Timeout waiting for error")), 5000),
        ),
      ]);

      expect(errorMessage).toContain("Uncaught error");
    }
  },
);
