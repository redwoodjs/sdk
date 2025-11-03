import {
  poll,
  setupPlaygroundEnvironment,
  testDevAndDeploy,
  waitForHydration,
} from "rwsdk/e2e";
import { describe, expect } from "vitest";

setupPlaygroundEnvironment(import.meta.url);

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
    const getPageContent = () => page.content();

    await poll(async () => {
      const content = await getPageContent();
      expect(content).toContain("useId Test Playground");
      expect(content).toContain("Server-Only Components");
      expect(content).toContain("Client-Only Components");
      expect(content).toContain("Mixed Server/Client Components");
      return true;
    });
  });

  testDevAndDeploy(
    "server-only page maintains stable IDs",
    async ({ page, url }) => {
      await page.goto(`${url}/server-only`);
      const getPageContent = () => page.content();

      await poll(async () => {
        const content = await getPageContent();
        expect(content).toContain("Server-Only useId Test");
        return true;
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
      const getPageContent = () => page.content();
      const getElementText = (selector: string) =>
        page.$eval(selector, (el) => el.textContent);

      await poll(async () => {
        const content = await getPageContent();
        expect(content).toContain("Client-Only useId Test");
        return true;
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
        const status = await getElementText('[data-testid="hydration-status"]');
        expect(status).toContain("Client hydration complete");
        return true;
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
      const getPageContent = () => page.content();

      await poll(async () => {
        const content = await getPageContent();
        expect(content).toContain("Mixed Server/Client useId Test");
        return true;
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
        expect(
          statuses.every(
            (status: string | null) => status?.includes("Hydrated") ?? false,
          ),
        ).toBe(true);
        return true;
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
    // todo(justinvdm, 3 Nov 2025): Investigate asset loading errors.
    { checkForPageErrors: false },
  );
});
