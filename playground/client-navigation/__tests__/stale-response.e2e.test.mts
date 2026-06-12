import { setupPlaygroundEnvironment, testDeploy, waitForHydration } from "rwsdk/e2e";
import { expect } from "vitest";

setupPlaygroundEnvironment({
  sourceProjectDir: import.meta.url,
  dev: false,
  deploy: true,
});

testDeploy(
  "rejects stale RSC requests with a reload response",
  async ({ page, url }) => {
    await page.goto(url);
    await waitForHydration(page);

    const result = await page.evaluate(async () => {
      const requestUrl = new URL("/about", window.location.href);
      requestUrl.searchParams.set("__rsc", "");

      const response = await fetch(requestUrl.toString(), {
        headers: {
          "x-rwsdk-client-version": "stale-build",
        },
        redirect: "manual",
      });

      return {
        status: response.status,
        stale: response.headers.get("x-rwsdk-stale"),
      };
    });

    expect(result.status).toBe(409);
    expect(result.stale).toBe("reload");
  },
);
