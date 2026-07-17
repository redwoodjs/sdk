import {
  installLocalPackages,
  poll,
  setupPlaygroundEnvironment,
  testDevAndDeploy,
} from "rwsdk/e2e";
import { expect } from "vitest";

setupPlaygroundEnvironment({
  sourceProjectDir: import.meta.url,
  afterInstall: async ({ targetDir, packageManager }) => {
    await installLocalPackages({
      packagesDir: new URL("../packages", import.meta.url).pathname,
      targetDir,
      packageManager,
    });
  },
});

testDevAndDeploy(
  "renders excluded client component reached through prebundled server component",
  async ({ page, url }) => {
    await page.goto(url);

    const getPageContent = () => page.content();

    await poll(async () => {
      const content = await getPageContent();
      expect(content).toContain("Rendered by dep-a");
      expect(content).toContain("Rendered by dep-b");
      expect(content).toContain("Rendered by dep-x");
      return true;
    });
  },
);
