import { poll, setupPlaygroundEnvironment, testDevAndDeploy } from "rwsdk/e2e";
import { expect } from "vitest";

setupPlaygroundEnvironment(import.meta.url);

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
