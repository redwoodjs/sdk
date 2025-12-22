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

    // Wait for the error demo buttons to be available
    const getUncaughtErrorButton = async () => {
      const buttons = await page.$$("button");
      for (const button of buttons) {
        const text = await page.evaluate((el) => el.textContent, button);
        if (text?.includes("Trigger Uncaught Error")) {
          return button;
        }
      }
      return null;
    };

    await poll(async () => {
      const button = await getUncaughtErrorButton();
      expect(button).not.toBeNull();
      return button !== null;
    });

    const uncaughtErrorButton = await getUncaughtErrorButton();

    // Click the button and wait for navigation to /error
    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle0", timeout: 10000 }),
      uncaughtErrorButton!.click(),
    ]);

    // Verify we were redirected to /error
    expect(page.url()).toContain("/error");

    // Wait for the error page to be fully loaded
    await page.waitForFunction("document.readyState === 'complete'");

    // Verify the error page content is displayed
    const getErrorPageContent = () => page.content();
    await poll(
      async () => {
        const content = await getErrorPageContent();
        expect(content).toContain("Error Page");
        expect(content).not.toContain("Hello World");
        return true;
      },
      { timeout: 10000 },
    );
  },
);

testDevAndDeploy(
  "error handling works for async errors",
  async ({ page, url }) => {
    await page.goto(url);

    // Wait for page to be fully interactive
    await page.waitForFunction("document.readyState === 'complete'");

    // Wait for the error demo buttons to be available
    const getAsyncErrorButton = async () => {
      const buttons = await page.$$("button");
      for (const button of buttons) {
        const text = await page.evaluate((el) => el.textContent, button);
        if (text?.includes("Trigger Async Error")) {
          return button;
        }
      }
      return null;
    };

    await poll(async () => {
      const button = await getAsyncErrorButton();
      expect(button).not.toBeNull();
      return button !== null;
    });

    const asyncErrorButton = await getAsyncErrorButton();

    // Click the button that triggers an async error
    // Async errors happen after a setTimeout, so navigation may be delayed
    await asyncErrorButton!.click();

    // Wait for navigation to /error (with longer timeout for async error)
    await page.waitForNavigation({ waitUntil: "networkidle0", timeout: 10000 });

    // Verify we were redirected to /error
    expect(page.url()).toContain("/error");

    // Wait for the error page to be fully loaded
    await page.waitForFunction("document.readyState === 'complete'");

    // Verify the error page content is displayed
    const getErrorPageContent = () => page.content();
    await poll(
      async () => {
        const content = await getErrorPageContent();
        expect(content).toContain("Error Page");
        expect(content).not.toContain("Hello World");
        return true;
      },
      { timeout: 10000 },
    );
  },
);
