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
      expect(content).toContain("<h1>Request Info</h1>");
      expect(content).toContain("<p>URL: /</p>");
      expect(content).toContain("<p>Render count: 1</p>");
      return true;
    });

    const homePagePath = join(projectDir, "src/app/pages/Home.tsx");
    const originalContent = await readFile(homePagePath, "utf-8");

    const modifiedContent = originalContent
      .replace(
        'import type { RequestInfo } from "rwsdk/worker";',
        `import type { RequestInfo } from "rwsdk/worker";
import { ClientComponent } from "../../components/ClientComponent";
import { ServerComponent } from "../../components/ServerComponent";
import { PlainComponent } from "../../components/PlainComponent";
`,
      )
      .replace("{/* <ClientComponent /> */}", "<ClientComponent />")
      .replace("{/* <ServerComponent /> */}", "<ServerComponent />")
      .replace("{/* <PlainComponent /> */}", "<PlainComponent />");

    await writeFile(homePagePath, modifiedContent);

    await poll(async () => {
      const content = await getPageContent();

      const hasAllComponents =
        content.includes("<h2>Client Component</h2>") &&
        content.includes("<h2>Server Component</h2>") &&
        content.includes("<h2>Plain Component</h2>") &&
        content.includes("from client dep") &&
        content.includes("from server dep") &&
        content.includes("from plain dep");

      expect(hasAllComponents).toBe(true);
      expect(content).toContain("<p>Render count: 1</p>"); // Should not re-increment
      return true;
    });
  },
);

testDeploy("requestInfo state works in production", async ({ page, url }) => {
  await page.goto(url);
  await waitForHydration(page);

  const content = await page.content();
  expect(content).toContain("<h1>Request Info</h1>");
  expect(content).toContain("<p>URL: /</p>");
  expect(content).toContain("<p>Render count: 1</p>");
});

testDev(
  "server action can modify requestInfo",
  async ({ page, url, projectDir }) => {
    await page.goto(url);
    await waitForHydration(page);

    const homePagePath = join(projectDir, "src/app/pages/Home.tsx");
    const originalContent = await readFile(homePagePath, "utf-8");

    const modifiedContent = originalContent
      .replace(
        'import type { RequestInfo } from "rwsdk/worker";',
        `import type { RequestInfo } from "rwsdk/worker";
import { ActionButtonComponent } from "../../components/ActionButtonComponent";`,
      )
      .replace(
        "{/* <ActionButtonComponent /> */}",
        "<ActionButtonComponent />",
      );

    await writeFile(homePagePath, modifiedContent);

    await poll(async () => {
      const content = await page.content();
      return content.includes("Set Header via Server Action");
    });

    let serverActionResponse: any;
    page.on("response", (response) => {
      if (response.url().includes("?_rsc")) {
        serverActionResponse = response;
      }
    });

    await page.click('button:has-text("Set Header via Server Action")');

    await poll(() => !!serverActionResponse);

    const headers = await serverActionResponse.allHeaders();
    expect(headers["x-server-action"]).toBe("true");
  },
);
