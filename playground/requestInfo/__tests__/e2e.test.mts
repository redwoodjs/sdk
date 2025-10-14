import { execa } from "execa";
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

    // 1. Add new deps to package.json
    const pkgJsonPath = join(projectDir, "package.json");
    const pkgJson = JSON.parse(await readFile(pkgJsonPath, "utf-8"));
    pkgJson.dependencies["is-number"] = "7.0.0";
    pkgJson.dependencies["is-odd"] = "3.0.1";
    pkgJson.dependencies["is-even"] = "1.0.0";
    await writeFile(pkgJsonPath, JSON.stringify(pkgJson, null, 2));

    // 2. Install the new dependencies
    await execa("pnpm", ["install"], { cwd: projectDir, stdio: "inherit" });

    // 3. Uncomment components to trigger re-optimization
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

    // 4. Wait for components to render
    await poll(async () => {
      const content = await getPageContent();
      const hasClientComponent = content.includes("Is 5 a number? Yes");
      const hasServerComponent = content.includes("Is 2 even? Yes");
      return hasClientComponent && hasServerComponent;
    });

    // 5. Click the button to call the server action
    await page.click('button:has-text("Call Server Action")');

    // 6. Assert that the server action result is displayed and state is preserved
    await poll(async () => {
      const content = await getPageContent();
      const hasActionResult = content.includes(
        "Server action result: Is 3 odd? Yes",
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
