import { poll, setupPlaygroundEnvironment, testDevAndDeploy } from "rwsdk/e2e";
import { expect } from "vitest";

setupPlaygroundEnvironment(import.meta.url);

testDevAndDeploy(
  "should not redirect when accessing a route in a different prefix",
  async ({ page, url }) => {
    const getPageContent = async () => await page.content();
    const getResponseStatus = async () => {
      const response = await page.goto(url + "/api/health");
      return response?.status();
    };

    await poll(async () => {
      const status = await getResponseStatus();
      expect(status).toBe(200);
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
