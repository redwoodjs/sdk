import { describe, expect } from "vitest";
import {
  setupPlaygroundEnvironment,
  testDevServer,
  testDeployment,
  poll,
} from "rwsdk/e2e";

setupPlaygroundEnvironment();

describe("Render APIs Playground - Dev Server", () => {
  testDevServer("home page renders navigation", async ({ page, url }) => {
    await page.goto(url);

    await poll(async () => {
      const content = await page.content();
      return content.includes("Render APIs Test Playground");
    });

    expect(await page.content()).toContain("Render APIs Test Playground");
    expect(await page.content()).toContain("renderToStream API Test");
    expect(await page.content()).toContain("renderToString API Test");
  });

  testDevServer("renderToStream API works correctly", async ({ page, url }) => {
    await page.goto(`${url}/render-to-stream`);

    await poll(async () => {
      const content = await page.content();
      return content.includes("renderToStream API Test");
    });

    // Verify page content
    expect(await page.content()).toContain("renderToStream API Test");
    expect(await page.content()).toContain("renderToStream Test Status");

    // Verify the test content section is present
    const testContent = page.locator('[data-testid="render-stream-content"]');
    expect(await testContent.count()).toBe(1);
  });

  testDevServer("renderToString API works correctly", async ({ page, url }) => {
    await page.goto(`${url}/render-to-string`);

    await poll(async () => {
      const content = await page.content();
      return content.includes("renderToString API Test");
    });

    // Verify page content
    expect(await page.content()).toContain("renderToString API Test");
    expect(await page.content()).toContain("renderToString Test Status");

    // Verify the test content section is present
    const testContent = page.locator('[data-testid="render-string-content"]');
    expect(await testContent.count()).toBe(1);
  });

  testDevServer("both APIs render successfully", async ({ page, url }) => {
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

describe("Render APIs Playground - Deployment", () => {
  testDeployment("home page renders navigation", async ({ page, url }) => {
    await page.goto(url);

    await poll(async () => {
      const content = await page.content();
      return content.includes("Render APIs Test Playground");
    });

    expect(await page.content()).toContain("Render APIs Test Playground");
    expect(await page.content()).toContain("renderToStream API Test");
    expect(await page.content()).toContain("renderToString API Test");
  });

  testDeployment(
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
      const testContent = page.locator('[data-testid="render-stream-content"]');
      expect(await testContent.count()).toBe(1);
    },
  );

  testDeployment(
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
      const testContent = page.locator('[data-testid="render-string-content"]');
      expect(await testContent.count()).toBe(1);
    },
  );

  testDeployment("both APIs render successfully", async ({ page, url }) => {
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
