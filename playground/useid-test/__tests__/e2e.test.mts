import { expect } from "vitest";
import {
  setupPlaygroundEnvironment,
  testDevServer,
  testDeployment,
  poll,
} from "rwsdk/e2e";

setupPlaygroundEnvironment();

// Helper function to wait for hydration to complete
async function waitForHydration(page: any, timeout = 5000) {
  await page.waitForTimeout(1000); // Initial wait for scripts to load

  // Wait for DOMContentLoaded and any hydration indicators
  await page.evaluate(() => {
    return new Promise((resolve) => {
      if (document.readyState === "complete") {
        // Additional wait for React hydration
        setTimeout(resolve, 500);
      } else {
        window.addEventListener("load", () => {
          setTimeout(resolve, 500);
        });
      }
    });
  });
}

// Helper function to extract useId values from elements
async function extractUseIdValues(page: any, testIds: string[]) {
  const values: Record<string, string> = {};

  for (const testId of testIds) {
    const element = await page.locator(`[data-testid="${testId}"]`);
    if ((await element.count()) > 0) {
      values[testId] = await element.textContent();
    }
  }

  return values;
}

describe("useId Playground - Dev Server", () => {
  testDevServer("home page renders navigation", async ({ page, url }) => {
    await page.goto(url);

    await poll(async () => {
      const content = await page.content();
      return content.includes("useId Test Playground");
    });

    expect(await page.content()).toContain("useId Test Playground");
    expect(await page.content()).toContain("Server-Only Components");
    expect(await page.content()).toContain("Client-Only Components");
    expect(await page.content()).toContain("Mixed Server/Client Components");
  });

  testDevServer(
    "server-only page maintains stable IDs",
    async ({ page, url }) => {
      await page.goto(`${url}/server-only`);

      await poll(async () => {
        const content = await page.content();
        return content.includes("Server-Only useId Test");
      });

      // Get initial server-rendered IDs
      const initialIds = await extractUseIdValues(page, [
        "server-id-1",
        "server-id-2",
      ]);

      // Wait a bit to ensure no hydration changes occur
      await page.waitForTimeout(2000);

      // Get IDs after potential hydration
      const afterIds = await extractUseIdValues(page, [
        "server-id-1",
        "server-id-2",
      ]);

      // Server-only components should have stable IDs
      expect(initialIds["server-id-1"]).toBeTruthy();
      expect(initialIds["server-id-2"]).toBeTruthy();
      expect(initialIds["server-id-1"]).toBe(afterIds["server-id-1"]);
      expect(initialIds["server-id-2"]).toBe(afterIds["server-id-2"]);

      // Verify the IDs follow the expected server pattern (_R_)
      expect(initialIds["server-id-1"]).toMatch(/^_R_\w+_$/);
      expect(initialIds["server-id-2"]).toMatch(/^_R_\w+_$/);
    },
  );

  testDevServer(
    "client-only page hydrates consistently",
    async ({ page, url }) => {
      await page.goto(`${url}/client-only`);

      await poll(async () => {
        const content = await page.content();
        return content.includes("Client-Only useId Test");
      });

      // Get initial server-rendered IDs
      const initialIds = await extractUseIdValues(page, [
        "client-id-1",
        "client-id-2",
      ]);

      // Wait for hydration to complete
      await waitForHydration(page);

      // Wait for hydration status to update
      await poll(async () => {
        const status = await page
          .locator('[data-testid="hydration-status"]')
          .textContent();
        return status?.includes("Client hydration complete") ?? false;
      });

      // Get IDs after hydration
      const afterIds = await extractUseIdValues(page, [
        "client-id-1",
        "client-id-2",
      ]);

      // Client component IDs should remain consistent after hydration
      expect(initialIds["client-id-1"]).toBeTruthy();
      expect(initialIds["client-id-2"]).toBeTruthy();
      expect(initialIds["client-id-1"]).toBe(afterIds["client-id-1"]);
      expect(initialIds["client-id-2"]).toBe(afterIds["client-id-2"]);

      // Verify the IDs follow the expected hydration pattern (_R_)
      expect(initialIds["client-id-1"]).toMatch(/^_R_\w+_$/);
      expect(initialIds["client-id-2"]).toMatch(/^_R_\w+_$/);
    },
  );

  testDevServer(
    "mixed page maintains server IDs and hydrates client IDs consistently",
    async ({ page, url }) => {
      await page.goto(`${url}/mixed`);

      await poll(async () => {
        const content = await page.content();
        return content.includes("Mixed Server/Client useId Test");
      });

      // Get initial server-rendered IDs
      const initialServerIds = await extractUseIdValues(page, [
        "mixed-server-id-1",
        "mixed-server-id-2",
      ]);
      const initialClientIds = await extractUseIdValues(page, [
        "mixed-client-id-1",
        "mixed-client-id-2",
      ]);

      // Wait for hydration to complete
      await waitForHydration(page);

      // Wait for client components to show hydration complete
      await poll(async () => {
        const statuses = await page
          .locator('[data-testid="mixed-hydration-status"]')
          .allTextContents();
        return statuses.every((status) => status.includes("Hydrated"));
      });

      // Get IDs after hydration
      const afterServerIds = await extractUseIdValues(page, [
        "mixed-server-id-1",
        "mixed-server-id-2",
      ]);
      const afterClientIds = await extractUseIdValues(page, [
        "mixed-client-id-1",
        "mixed-client-id-2",
      ]);

      // Server component IDs should remain stable
      expect(initialServerIds["mixed-server-id-1"]).toBeTruthy();
      expect(initialServerIds["mixed-server-id-2"]).toBeTruthy();
      expect(initialServerIds["mixed-server-id-1"]).toBe(
        afterServerIds["mixed-server-id-1"],
      );
      expect(initialServerIds["mixed-server-id-2"]).toBe(
        afterServerIds["mixed-server-id-2"],
      );

      // Client component IDs should remain consistent after hydration
      expect(initialClientIds["mixed-client-id-1"]).toBeTruthy();
      expect(initialClientIds["mixed-client-id-2"]).toBeTruthy();
      expect(initialClientIds["mixed-client-id-1"]).toBe(
        afterClientIds["mixed-client-id-1"],
      );
      expect(initialClientIds["mixed-client-id-2"]).toBe(
        afterClientIds["mixed-client-id-2"],
      );

      // Verify all IDs follow the expected pattern
      expect(initialServerIds["mixed-server-id-1"]).toMatch(/^_R_\w+_$/);
      expect(initialServerIds["mixed-server-id-2"]).toMatch(/^_R_\w+_$/);
      expect(initialClientIds["mixed-client-id-1"]).toMatch(/^_R_\w+_$/);
      expect(initialClientIds["mixed-client-id-2"]).toMatch(/^_R_\w+_$/);
    },
  );
});

describe("useId Playground - Deployment", () => {
  testDeployment("home page renders navigation", async ({ page, url }) => {
    await page.goto(url);

    await poll(async () => {
      const content = await page.content();
      return content.includes("useId Test Playground");
    });

    expect(await page.content()).toContain("useId Test Playground");
    expect(await page.content()).toContain("Server-Only Components");
    expect(await page.content()).toContain("Client-Only Components");
    expect(await page.content()).toContain("Mixed Server/Client Components");
  });

  testDeployment(
    "server-only page maintains stable IDs",
    async ({ page, url }) => {
      await page.goto(`${url}/server-only`);

      await poll(async () => {
        const content = await page.content();
        return content.includes("Server-Only useId Test");
      });

      // Get initial server-rendered IDs
      const initialIds = await extractUseIdValues(page, [
        "server-id-1",
        "server-id-2",
      ]);

      // Wait a bit to ensure no hydration changes occur
      await page.waitForTimeout(2000);

      // Get IDs after potential hydration
      const afterIds = await extractUseIdValues(page, [
        "server-id-1",
        "server-id-2",
      ]);

      // Server-only components should have stable IDs
      expect(initialIds["server-id-1"]).toBeTruthy();
      expect(initialIds["server-id-2"]).toBeTruthy();
      expect(initialIds["server-id-1"]).toBe(afterIds["server-id-1"]);
      expect(initialIds["server-id-2"]).toBe(afterIds["server-id-2"]);

      // Verify the IDs follow the expected server pattern (_R_)
      expect(initialIds["server-id-1"]).toMatch(/^_R_\w+_$/);
      expect(initialIds["server-id-2"]).toMatch(/^_R_\w+_$/);
    },
  );

  testDeployment(
    "client-only page hydrates consistently",
    async ({ page, url }) => {
      await page.goto(`${url}/client-only`);

      await poll(async () => {
        const content = await page.content();
        return content.includes("Client-Only useId Test");
      });

      // Get initial server-rendered IDs
      const initialIds = await extractUseIdValues(page, [
        "client-id-1",
        "client-id-2",
      ]);

      // Wait for hydration to complete
      await waitForHydration(page);

      // Wait for hydration status to update
      await poll(async () => {
        const status = await page
          .locator('[data-testid="hydration-status"]')
          .textContent();
        return status?.includes("Client hydration complete") ?? false;
      });

      // Get IDs after hydration
      const afterIds = await extractUseIdValues(page, [
        "client-id-1",
        "client-id-2",
      ]);

      // Client component IDs should remain consistent after hydration
      expect(initialIds["client-id-1"]).toBeTruthy();
      expect(initialIds["client-id-2"]).toBeTruthy();
      expect(initialIds["client-id-1"]).toBe(afterIds["client-id-1"]);
      expect(initialIds["client-id-2"]).toBe(afterIds["client-id-2"]);

      // Verify the IDs follow the expected hydration pattern (_R_)
      expect(initialIds["client-id-1"]).toMatch(/^_R_\w+_$/);
      expect(initialIds["client-id-2"]).toMatch(/^_R_\w+_$/);
    },
  );

  testDeployment(
    "mixed page maintains server IDs and hydrates client IDs consistently",
    async ({ page, url }) => {
      await page.goto(`${url}/mixed`);

      await poll(async () => {
        const content = await page.content();
        return content.includes("Mixed Server/Client useId Test");
      });

      // Get initial server-rendered IDs
      const initialServerIds = await extractUseIdValues(page, [
        "mixed-server-id-1",
        "mixed-server-id-2",
      ]);
      const initialClientIds = await extractUseIdValues(page, [
        "mixed-client-id-1",
        "mixed-client-id-2",
      ]);

      // Wait for hydration to complete
      await waitForHydration(page);

      // Wait for client components to show hydration complete
      await poll(async () => {
        const statuses = await page
          .locator('[data-testid="mixed-hydration-status"]')
          .allTextContents();
        return statuses.every((status) => status.includes("Hydrated"));
      });

      // Get IDs after hydration
      const afterServerIds = await extractUseIdValues(page, [
        "mixed-server-id-1",
        "mixed-server-id-2",
      ]);
      const afterClientIds = await extractUseIdValues(page, [
        "mixed-client-id-1",
        "mixed-client-id-2",
      ]);

      // Server component IDs should remain stable
      expect(initialServerIds["mixed-server-id-1"]).toBeTruthy();
      expect(initialServerIds["mixed-server-id-2"]).toBeTruthy();
      expect(initialServerIds["mixed-server-id-1"]).toBe(
        afterServerIds["mixed-server-id-1"],
      );
      expect(initialServerIds["mixed-server-id-2"]).toBe(
        afterServerIds["mixed-server-id-2"],
      );

      // Client component IDs should remain consistent after hydration
      expect(initialClientIds["mixed-client-id-1"]).toBeTruthy();
      expect(initialClientIds["mixed-client-id-2"]).toBeTruthy();
      expect(initialClientIds["mixed-client-id-1"]).toBe(
        afterClientIds["mixed-client-id-1"],
      );
      expect(initialClientIds["mixed-client-id-2"]).toBe(
        afterClientIds["mixed-client-id-2"],
      );

      // Verify all IDs follow the expected pattern
      expect(initialServerIds["mixed-server-id-1"]).toMatch(/^_R_\w+_$/);
      expect(initialServerIds["mixed-server-id-2"]).toMatch(/^_R_\w+_$/);
      expect(initialClientIds["mixed-client-id-1"]).toMatch(/^_R_\w+_$/);
      expect(initialClientIds["mixed-client-id-2"]).toMatch(/^_R_\w+_$/);
    },
  );
});
