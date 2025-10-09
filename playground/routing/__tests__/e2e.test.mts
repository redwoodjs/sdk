import { poll, setupPlaygroundEnvironment, testDevAndDeploy } from "rwsdk/e2e";
import { expect } from "vitest";

setupPlaygroundEnvironment(import.meta.url);

testDevAndDeploy(
  "should not redirect /api/health when middleware is in /dashboard prefix",
  async ({ page, url }) => {
    const getPageContent = async () => await page.content();

    // Test /api/health - should NOT redirect to /auth
    await poll(async () => {
      const response = await page.goto(url + "/api/health");
      expect(response?.status()).toBe(200);
      return true;
    });

    await poll(async () => {
      expect(page.url()).toBe(url + "/api/health");
      return true;
    });

    await poll(async () => {
      const content = await getPageContent();
      expect(content).toContain("OK");
      return true;
    });
  },
);

testDevAndDeploy(
  "should redirect /dashboard when middleware is applied",
  async ({ page, url }) => {
    // Test /dashboard/ - SHOULD redirect to /auth
    await poll(async () => {
      const response = await page.goto(url + "/dashboard/");
      // Should be a redirect (status 302 or 307)
      expect([302, 307]).toContain(response?.status() || 0);
      return true;
    });

    await poll(async () => {
      expect(page.url()).toContain("/auth");
      return true;
    });
  },
);
