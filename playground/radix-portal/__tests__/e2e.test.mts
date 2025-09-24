import { describe, expect } from "vitest";
import { setupPlaygroundEnvironment, testDevAndDeploy, poll } from "rwsdk/e2e";

setupPlaygroundEnvironment(import.meta.url);

describe("Portal Freeze Issue", () => {
  testDevAndDeploy(
    "it should render the portal content without freezing",
    async ({ page, url }) => {
      await page.goto(url);
      await page.waitForSelector("h1");

      await poll(async () => {
        const portalText = await page.$eval("h2", (el) => {
          return el.textContent;
        });
        return portalText === "This is a portal!";
      });
    },
  );
});
