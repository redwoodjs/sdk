import { describe, expect } from "vitest";
import { setupPlaygroundEnvironment, testDevAndDeploy, poll } from "rwsdk/e2e";

setupPlaygroundEnvironment(import.meta.url);

describe("Render APIs Playground", () => {
  testDevAndDeploy("home page renders navigation", async ({ page, url }) => {
    await page.goto(url);

    const getPageContent = () => page.content();

    await poll(async () => {
      const content = await getPageContent();
      expect(content).toContain("Render APIs Test Playground");
      expect(content).toContain("renderToStream API Test");
      expect(content).toContain("renderToString API Test");
      return true;
    });
  });

  testDevAndDeploy(
    "renderToStream API works correctly",
    async ({ page, url }) => {
      await page.goto(`${url}/render-to-stream`);

      const getPageContent = () => page.content();

      await poll(async () => {
        const content = await getPageContent();
        expect(content).toContain("renderToStream API Test");
        expect(content).toContain("renderToStream Test Status");
        const testContent = await page.$(
          '[data-testid="render-stream-content"]',
        );
        expect(testContent).toBeTruthy();
        return true;
      });
    },
  );

  testDevAndDeploy(
    "renderToString API works correctly",
    async ({ page, url }) => {
      await page.goto(`${url}/render-to-string`);

      const getPageContent = () => page.content();

      await poll(async () => {
        const content = await getPageContent();
        expect(content).toContain("renderToString API Test");
        expect(content).toContain("renderToString Test Status");
        const testContent = await page.$(
          '[data-testid="render-string-content"]',
        );
        expect(testContent).toBeTruthy();
        return true;
      });
    },
  );

  testDevAndDeploy("both APIs render successfully", async ({ page, url }) => {
    const getPageContent = () => page.content();

    // Test renderToStream page
    await page.goto(`${url}/render-to-stream`);
    await poll(async () => {
      const content = await getPageContent();
      expect(content).toContain("renderToStream API Test");
      return true;
    });

    // Test renderToString page
    await page.goto(`${url}/render-to-string`);
    await poll(async () => {
      const content = await getPageContent();
      expect(content).toContain("renderToString API Test");
      return true;
    });
  });
});
