import { poll, setupPlaygroundEnvironment, testDevAndDeploy, waitForHydration } from "rwsdk/e2e";
import { expect } from "vitest";

setupPlaygroundEnvironment(import.meta.url);

testDevAndDeploy("renders Hello World", async ({ page, url }) => {
  await page.goto(url);
  await waitForHydration(page);

  const getPageContent = () => page.content();

  await poll(async () => {
    const content = await getPageContent();
    expect(content).toContain("Hello World");
    return true;
  });
});

testDevAndDeploy("error handling demo is visible", async ({ page, url }) => {
  await page.goto(url);
  await waitForHydration(page);

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
    await waitForHydration(page);

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
      page.waitForNavigation({ waitUntil: "load", timeout: 30000 }),
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
    await waitForHydration(page);

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
    await page.waitForNavigation({ waitUntil: "load", timeout: 30000 });

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
  "except handler catches errors from route handlers",
  async ({ page, url }) => {
    // Navigate directly to the route that throws an error
    await page.goto(`${url}/debug/throw`);

    await waitForHydration(page);

    // Verify the error page is displayed (caught by except handler)
    const getErrorPageContent = () => page.content();
    await poll(
      async () => {
        const content = await getErrorPageContent();
        expect(content).toContain("Error Page");
        expect(content).toContain("Error Details");
        expect(content).toContain(
          "This is a test error from the /debug/throw route",
        );
        expect(content).not.toContain("Hello World");
        return true;
      },
      { timeout: 10000 },
    );
  },
);

testDevAndDeploy(
  "client components work on initial load (inc. .client.tsx and inlined functions)",
  async ({ page, url }) => {
    await page.goto(url);
    await waitForHydration(page);

    // 1. Verify Button.client.tsx works
    const getClientButton = () => page.$("#client-button");
    await poll(async () => {
      const button = await getClientButton();
      expect(button).not.toBeNull();
      return true;
    });

    const buttonTextBefore = await page.$eval(
      "#client-button",
      (el) => el.textContent,
    );
    expect(buttonTextBefore).toContain("Client Count: 0");

    await (await getClientButton())!.click();

    await poll(async () => {
      const text = await page.$eval("#client-button", (el) => el.textContent);
      expect(text).toContain("Client Count: 1");
      return true;
    });

    // 2. Verify Stars.client.tsx works (Issue #471 repro)
    const getStarsContainer = () => page.$("#stars-container");
    await poll(async () => {
      const container = await getStarsContainer();
      expect(container).not.toBeNull();
      return true;
    });

    const starsCount = await page.$eval(
      "#stars-container",
      (el) => el.children.length,
    );
    expect(starsCount).toBe(5);
  },
);
