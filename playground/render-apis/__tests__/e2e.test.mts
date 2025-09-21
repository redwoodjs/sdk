import { describe, expect } from "vitest";
import { setupPlaygroundEnvironment, testDevAndDeploy, poll } from "rwsdk/e2e";

setupPlaygroundEnvironment(import.meta.url);

describe("Render APIs Playground", () => {
  testDevAndDeploy("home page renders navigation", async ({ page, url }) => {
    await page.goto(url);

    await poll(async () => {
      const content = await page.content();
      return content.includes("Render APIs Test Playground");
    });

    expect(await page.content()).toContain("Render APIs Test Playground");
    expect(await page.content()).toContain("renderToStream API Test");
    expect(await page.content()).toContain("renderToString API Test");
  });

  testDevAndDeploy(
    "renderToStream API works correctly",
    async ({ page, url }) => {
      await page.goto(`${url}/render-to-stream`);

      await poll(async () => {
        const content = await page.content();
        return content.includes("renderToStream API Test");
      });

      // Verify page content
      expect(await page.content()).toContain("renderToStream API Test");
      expect(await page.content()).toContain("renderToStream Test Status");

      // Verify the test content section is present
      const testContent = await page.$('[data-testid="render-stream-content"]');
      expect(testContent).toBeTruthy();
    },
  );

  testDevAndDeploy(
    "renderToString API works correctly",
    async ({ page, url }) => {
      await page.goto(`${url}/render-to-string`);

      await poll(async () => {
        const content = await page.content();
        return content.includes("renderToString API Test");
      });

      // Verify page content
      expect(await page.content()).toContain("renderToString API Test");
      expect(await page.content()).toContain("renderToString Test Status");

      // Verify the test content section is present
      const testContent = await page.$('[data-testid="render-string-content"]');
      expect(testContent).toBeTruthy();
    },
  );

  testDevAndDeploy("both APIs render successfully", async ({ page, url }) => {
    // Test renderToStream page
    await page.goto(`${url}/render-to-stream`);
    await poll(async () => {
      const content = await page.content();
      return content.includes("renderToStream API Test");
    });

    // Test renderToString page
    await page.goto(`${url}/render-to-string`);
    await poll(async () => {
      const content = await page.content();
      return content.includes("renderToString API Test");
    });

    // Both APIs should render without errors
    expect(await page.content()).toContain("renderToString API Test");
  });
});
