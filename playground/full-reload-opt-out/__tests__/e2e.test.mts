import {
  poll,
  setupPlaygroundEnvironment,
  testDevAndDeploy,
  waitForHydration,
} from "rwsdk/e2e";
import { expect } from "vitest";

setupPlaygroundEnvironment(import.meta.url);

async function getLoadToken(page: any) {
  return page.evaluate(() => (window as any).__rwsdk_load_token);
}

testDevAndDeploy("renders the home page", async ({ page, url }) => {
  await page.goto(url);

  await poll(async () => {
    const content = await page.content();
    expect(content).toContain("Home Page");
    return true;
  });
});

testDevAndDeploy(
  "shouldIntercept forces a full reload across the /admin boundary",
  async ({ page, url }) => {
    await page.goto(url);
    await waitForHydration(page);

    const tokenBefore = await getLoadToken(page);

    await page.click("#admin-link");

    await poll(async () => {
      const content = await page.content();
      expect(content).toContain("Admin Page");
      return true;
    });

    const tokenAfter = await getLoadToken(page);
    expect(tokenAfter).not.toBe(tokenBefore);
    expect(page.url()).toContain("/admin");
  },
);

testDevAndDeploy(
  "data-reload attribute forces a full reload",
  async ({ page, url }) => {
    await page.goto(new URL("admin", url).href);
    await waitForHydration(page);

    const tokenBefore = await getLoadToken(page);

    await page.click("#home-link");

    await poll(async () => {
      const content = await page.content();
      expect(content).toContain("Home Page");
      return true;
    });

    const tokenAfter = await getLoadToken(page);
    expect(tokenAfter).not.toBe(tokenBefore);
    expect(page.url()).not.toContain("/admin");
  },
);

testDevAndDeploy(
  "in-section navigation remains a soft client navigation",
  async ({ page, url }) => {
    await page.goto(new URL("admin", url).href);
    await waitForHydration(page);

    const tokenBefore = await getLoadToken(page);

    await page.click("#admin-details-link");

    await poll(async () => {
      const content = await page.content();
      expect(content).toContain("Admin Details Page");
      return true;
    });

    const tokenAfter = await getLoadToken(page);
    expect(tokenAfter).toBe(tokenBefore);
    expect(page.url()).toContain("/admin/details");
  },
);
