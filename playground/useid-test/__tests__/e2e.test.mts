import { describe, expect } from "vitest";
import { setupPlaygroundEnvironment, testDevAndDeploy, poll } from "rwsdk/e2e";

setupPlaygroundEnvironment(import.meta.url);

// Helper function to wait for hydration to complete
async function waitForHydration(page: any, timeout = 5000) {
  await new Promise((resolve) => setTimeout(resolve, 1000)); // Initial wait for scripts to load

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
    try {
      const element = await page.$(`[data-testid="${testId}"]`);
      if (element) {
        const textContent = await page.evaluate(
          (el: Element) => el.textContent,
          element,
        );
        if (textContent) {
          values[testId] = textContent;
        }
      }
    } catch {
      // Element not found, skip
    }
  }

  return values;
}

describe("useId Playground", () => {
  testDevAndDeploy("home page renders navigation", async ({ page, url }) => {
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

  testDevAndDeploy(
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
      await new Promise((resolve) => setTimeout(resolve, 2000));

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

      // Verify the IDs follow the expected server pattern (_S_)
      expect(initialIds["server-id-1"]).toMatch(/^_S_\w+_$/);
      expect(initialIds["server-id-2"]).toMatch(/^_S_\w+_$/);
    },
  );

  testDevAndDeploy(
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
        const element = await page.$('[data-testid="hydration-status"]');
        const status = element
          ? await page.evaluate((el: Element) => el.textContent, element)
          : null;
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

  testDevAndDeploy(
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
        "mixed-first-client-id-1",
        "mixed-first-client-id-2",
        "mixed-second-client-id-1",
        "mixed-second-client-id-2",
      ]);

      // Wait for hydration to complete
      await waitForHydration(page);

      // Wait for client components to show hydration complete
      await poll(async () => {
        const elements = await page.$$('[data-testid*="-hydration-status"]');
        const statuses = await Promise.all(
          elements.map((el) =>
            page.evaluate((element: Element) => element.textContent, el),
          ),
        );
        return statuses.every(
          (status: string | null) => status?.includes("Hydrated") ?? false,
        );
      });

      // Get IDs after hydration
      const afterServerIds = await extractUseIdValues(page, [
        "mixed-server-id-1",
        "mixed-server-id-2",
      ]);
      const afterClientIds = await extractUseIdValues(page, [
        "mixed-first-client-id-1",
        "mixed-first-client-id-2",
        "mixed-second-client-id-1",
        "mixed-second-client-id-2",
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
      expect(initialClientIds["mixed-first-client-id-1"]).toBeTruthy();
      expect(initialClientIds["mixed-first-client-id-2"]).toBeTruthy();
      expect(initialClientIds["mixed-second-client-id-1"]).toBeTruthy();
      expect(initialClientIds["mixed-second-client-id-2"]).toBeTruthy();
      expect(initialClientIds["mixed-first-client-id-1"]).toBe(
        afterClientIds["mixed-first-client-id-1"],
      );
      expect(initialClientIds["mixed-first-client-id-2"]).toBe(
        afterClientIds["mixed-first-client-id-2"],
      );
      expect(initialClientIds["mixed-second-client-id-1"]).toBe(
        afterClientIds["mixed-second-client-id-1"],
      );
      expect(initialClientIds["mixed-second-client-id-2"]).toBe(
        afterClientIds["mixed-second-client-id-2"],
      );

      // Verify all IDs follow the expected pattern
      expect(initialServerIds["mixed-server-id-1"]).toMatch(/^_S_\w+_$/);
      expect(initialServerIds["mixed-server-id-2"]).toMatch(/^_S_\w+_$/);
      expect(initialClientIds["mixed-first-client-id-1"]).toMatch(/^_R_\w+_$/);
      expect(initialClientIds["mixed-first-client-id-2"]).toMatch(/^_R_\w+_$/);
      expect(initialClientIds["mixed-second-client-id-1"]).toMatch(/^_R_\w+_$/);
      expect(initialClientIds["mixed-second-client-id-2"]).toMatch(/^_R_\w+_$/);
    },
  );
});
