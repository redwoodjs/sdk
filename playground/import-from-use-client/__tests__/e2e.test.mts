import { describe, expect } from "vitest";
import {
  setupPlaygroundEnvironment,
  testDevAndDeploy,
  poll,
  waitForHydration,
} from "rwsdk/e2e";

setupPlaygroundEnvironment(import.meta.url);

describe("SSR Inter-Module Imports", () => {
  testDevAndDeploy(
    "it should correctly render messages from client utils",
    async ({ page, url }) => {
      await page.goto(url);
      await page.waitForSelector("button");

      const getMessageText = (selector: string) =>
        page.$eval(selector, (el) => el.textContent);

      // Scenario 1: App -> App
      await poll(async () => {
        const text = await getMessageText("#message-from-app-util");
        expect(text).toBe("Hello from the app, Home Page!");
        return true;
      });

      // Scenario 2: App -> Package
      await poll(async () => {
        const text = await getMessageText("#message-from-package-util");
        expect(text).toBe("Hello from the package, Home Page!");
        return true;
      });

      // Scenario 3: Package -> Package
      await poll(async () => {
        const text = await getMessageText(
          "#message-from-package-server-component",
        );
        expect(text).toBe("Hello from the package, Package Server Component!");
        return true;
      });
    },
  );

  testDevAndDeploy(
    "client components should be interactive",
    async ({ page, url }) => {
      await page.goto(url);

      const getAppButton = (count: number) =>
        page.waitForXPath(
          `//button[contains(., 'App Button clicks: ${count}')]`,
        );
      const getPackageButton = (count: number) =>
        page.waitForXPath(
          `//button[contains(., 'Package Button clicks: ${count}')]`,
        );

      await getAppButton(0);
      await getPackageButton(0);

      await waitForHydration(page);

      (await getAppButton(0))?.click();
      await poll(async () => {
        const button = await getAppButton(1);
        expect(button).not.toBeNull();
        return true;
      });

      (await getPackageButton(0))?.click();
      await poll(async () => {
        const button = await getPackageButton(1);
        expect(button).not.toBeNull();
        return true;
      });
    },
  );
});
