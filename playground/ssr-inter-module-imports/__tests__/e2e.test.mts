import { describe, expect } from "vitest";
import { setupPlaygroundEnvironment, testDevAndDeploy, poll } from "rwsdk/e2e";

setupPlaygroundEnvironment(import.meta.url);

describe("SSR Inter-Module Imports", () => {
  testDevAndDeploy(
    "it should correctly render messages from client utils",
    async ({ page, url }) => {
      await page.goto(url);
      await page.waitForSelector("button");

      // Scenario 1: App -> App
      await poll(async () => {
        const text = await page.$eval("#message-from-app-util", (el) => {
          return el.textContent;
        });
        return text === "Hello from the app, Home Page!";
      });

      // Scenario 2: App -> Package
      await poll(async () => {
        const text = await page.$eval("#message-from-package-util", (el) => {
          return el.textContent;
        });
        return text === "Hello from the package, Home Page!";
      });

      // Scenario 3: Package -> Package
      await poll(async () => {
        const text = await page.$eval(
          "#message-from-package-server-component",
          (el) => {
            return el.textContent;
          },
        );
        return text === "Hello from the package, Package Server Component!";
      });
    },
  );

  testDevAndDeploy(
    "client components should be interactive",
    async ({ page, url }) => {
      await page.goto(url);

      await page.waitForSelector("button:has-text('App Button clicks: 0')");

      await page.click("button:has-text('App Button clicks: 0')");
      await page.waitForSelector("button:has-text('App Button clicks: 1')");

      await page.click("button:has-text('Package Button clicks: 0')");
      await page.waitForSelector("button:has-text('Package Button clicks: 1')");
    },
  );
});
