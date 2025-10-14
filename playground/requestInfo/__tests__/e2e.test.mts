import { readFile, writeFile } from "fs/promises";
import { join } from "path";
import {
  poll,
  setupPlaygroundEnvironment,
  testDeploy,
  testDev,
  waitForHydration,
} from "rwsdk/e2e";
import { expect } from "vitest";

setupPlaygroundEnvironment(import.meta.url);

testDev(
  "requestInfo state is preserved across HMR",
  async ({ page, url, projectDir }) => {
    await page.goto(url);
    await waitForHydration(page);

    const getPageContent = () => page.content();

    await poll(async () => {
      const content = await getPageContent();
      expect(content).toContain("<p>Render count: 1</p>");
      return true;
    });

    // Uncommenting the components will trigger HMR and a re-optimization
    // because their dependencies are not yet known.
    const homePagePath = join(projectDir, "src/app/pages/Home.tsx");
    const originalContent = await readFile(homePagePath, "utf-8");
    const modifiedContent = originalContent
      .replace(
        'import type { RequestInfo } from "rwsdk/worker";',
        `import type { RequestInfo } from "rwsdk/worker";
import { ClientComponent } from "../../components/ClientComponent";
import { ServerComponent } from "../../components/ServerComponent";
`,
      )
      .replace("{/* <ClientComponent /> */}", "<ClientComponent />")
      .replace("{/* <ServerComponent /> */}", "<ServerComponent />");
    await writeFile(homePagePath, modifiedContent);

    // Wait for both components to render with their specific deps
    await poll(async () => {
      const content = await getPageContent();
      const hasClientComponent =
        content.includes("<h2>Client Component</h2>") &&
        content.includes("from client dep");
      const hasServerComponent =
        content.includes("<h2>Server Component</h2>") &&
        content.includes("from plain dep");
      return hasClientComponent && hasServerComponent;
    });

    // Click the button in the client component to call the server action
    await page.click('button:has-text("Call Server Action")');

    // Assert that the server action result is displayed, and the render count remains stable
    await poll(async () => {
      const content = await getPageContent();
      const hasActionResult = content.includes(
        "Server action result: from server dep",
      );
      expect(hasActionResult).toBe(true);
      expect(content).toContain("<p>Render count: 1</p>"); // Should not re-increment
      return true;
    });
  },
);

testDeploy("requestInfo state works in production", async ({ page, url }) => {
  await page.goto(url);
  await waitForHydration(page);

  const content = await page.content();
  expect(content).toContain("<p>Render count: 1</p>");
});
