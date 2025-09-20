import { expect } from "vitest";
import {
  setupPlaygroundEnvironment,
  testDevServer,
  testDeployment,
  poll,
} from "rwsdk/e2e";

setupPlaygroundEnvironment();

// Helper function to wait for client-side hydration
async function waitForHydration(page: any) {
  await page.waitForTimeout(1000); // Initial wait for scripts to load

  // Wait for client components to mount
  await poll(
    async () => {
      const mountStatus = await page.locator(
        '[data-testid="client-mount-status"]',
      );
      if ((await mountStatus.count()) > 0) {
        const status = await mountStatus.textContent();
        return status === "Mounted";
      }
      return true; // If no client components, consider it ready
    },
    { timeout: 5000 },
  );
}

// Helper function to verify component rendering
async function verifyComponentRendering(page: any, testIdPrefix: string) {
  // Check that components are rendered
  const serverComponent = page.locator(`[data-testid="test-component-server"]`);
  const clientComponent = page.locator(`[data-testid="client-test-component"]`);

  expect(await serverComponent.count()).toBe(1);
  expect(await clientComponent.count()).toBe(1);

  // Check component content
  const serverType = await page
    .locator(`[data-testid="component-type-server"]`)
    .textContent();
  const clientType = await page
    .locator(`[data-testid="client-component-type"]`)
    .textContent();

  expect(serverType).toBe("server");
  expect(clientType).toBe("client");

  // Check that IDs are generated
  const serverId = await page
    .locator(`[data-testid="component-id-server"]`)
    .textContent();
  const clientId = await page
    .locator(`[data-testid="client-component-id"]`)
    .textContent();

  expect(serverId).toBeTruthy();
  expect(clientId).toBeTruthy();
  expect(serverId).toMatch(/^_R_\w+_$/);
  expect(clientId).toMatch(/^_R_\w+_$/);

  return { serverId, clientId };
}

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

    // Get initial component state
    const initialIds = await verifyComponentRendering(page, "render-stream");

    // Wait for hydration
    await waitForHydration(page);

    // Verify components after hydration
    const afterIds = await verifyComponentRendering(page, "render-stream");

    // IDs should remain consistent after hydration
    expect(initialIds.serverId).toBe(afterIds.serverId);
    expect(initialIds.clientId).toBe(afterIds.clientId);

    // Verify the test status section is present
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

    // Get initial component state
    const initialIds = await verifyComponentRendering(page, "render-string");

    // Wait for hydration
    await waitForHydration(page);

    // Verify components after hydration
    const afterIds = await verifyComponentRendering(page, "render-string");

    // IDs should remain consistent after hydration
    expect(initialIds.serverId).toBe(afterIds.serverId);
    expect(initialIds.clientId).toBe(afterIds.clientId);

    // Verify the test status section is present
    const testContent = page.locator('[data-testid="render-string-content"]');
    expect(await testContent.count()).toBe(1);
  });

  testDevServer(
    "both APIs produce consistent results",
    async ({ page, url }) => {
      // Test renderToStream page
      await page.goto(`${url}/render-to-stream`);
      await poll(async () => {
        const content = await page.content();
        return content.includes("renderToStream API Test");
      });

      await waitForHydration(page);
      const streamIds = await verifyComponentRendering(page, "render-stream");

      // Test renderToString page
      await page.goto(`${url}/render-to-string`);
      await poll(async () => {
        const content = await page.content();
        return content.includes("renderToString API Test");
      });

      await waitForHydration(page);
      const stringIds = await verifyComponentRendering(page, "render-string");

      // Both APIs should produce valid IDs (though they may be different due to different render contexts)
      expect(streamIds.serverId).toMatch(/^_R_\w+_$/);
      expect(streamIds.clientId).toMatch(/^_R_\w+_$/);
      expect(stringIds.serverId).toMatch(/^_R_\w+_$/);
      expect(stringIds.clientId).toMatch(/^_R_\w+_$/);
    },
  );

  testDevServer("404 page works with renderToStream", async ({ page, url }) => {
    const response = await page.goto(`${url}/nonexistent-page`);

    expect(response?.status()).toBe(404);

    await poll(async () => {
      const content = await page.content();
      return content.includes("404 - Page Not Found");
    });

    expect(await page.content()).toContain("404 - Page Not Found");
    expect(await page.content()).toContain("Back to Home");
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

      // Get initial component state
      const initialIds = await verifyComponentRendering(page, "render-stream");

      // Wait for hydration
      await waitForHydration(page);

      // Verify components after hydration
      const afterIds = await verifyComponentRendering(page, "render-stream");

      // IDs should remain consistent after hydration
      expect(initialIds.serverId).toBe(afterIds.serverId);
      expect(initialIds.clientId).toBe(afterIds.clientId);

      // Verify the test status section is present
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

      // Get initial component state
      const initialIds = await verifyComponentRendering(page, "render-string");

      // Wait for hydration
      await waitForHydration(page);

      // Verify components after hydration
      const afterIds = await verifyComponentRendering(page, "render-string");

      // IDs should remain consistent after hydration
      expect(initialIds.serverId).toBe(afterIds.serverId);
      expect(initialIds.clientId).toBe(afterIds.clientId);

      // Verify the test status section is present
      const testContent = page.locator('[data-testid="render-string-content"]');
      expect(await testContent.count()).toBe(1);
    },
  );

  testDeployment(
    "both APIs produce consistent results",
    async ({ page, url }) => {
      // Test renderToStream page
      await page.goto(`${url}/render-to-stream`);
      await poll(async () => {
        const content = await page.content();
        return content.includes("renderToStream API Test");
      });

      await waitForHydration(page);
      const streamIds = await verifyComponentRendering(page, "render-stream");

      // Test renderToString page
      await page.goto(`${url}/render-to-string`);
      await poll(async () => {
        const content = await page.content();
        return content.includes("renderToString API Test");
      });

      await waitForHydration(page);
      const stringIds = await verifyComponentRendering(page, "render-string");

      // Both APIs should produce valid IDs (though they may be different due to different render contexts)
      expect(streamIds.serverId).toMatch(/^_R_\w+_$/);
      expect(streamIds.clientId).toMatch(/^_R_\w+_$/);
      expect(stringIds.serverId).toMatch(/^_R_\w+_$/);
      expect(stringIds.clientId).toMatch(/^_R_\w+_$/);
    },
  );

  testDeployment(
    "404 page works with renderToStream",
    async ({ page, url }) => {
      const response = await page.goto(`${url}/nonexistent-page`);

      expect(response?.status()).toBe(404);

      await poll(async () => {
        const content = await page.content();
        return content.includes("404 - Page Not Found");
      });

      expect(await page.content()).toContain("404 - Page Not Found");
      expect(await page.content()).toContain("Back to Home");
    },
  );
});
