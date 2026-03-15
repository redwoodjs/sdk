import {
  poll,
  setupPlaygroundEnvironment,
  testDeploy,
  testDevAndDeploy,
} from "rwsdk/e2e";
import { expect } from "vitest";

setupPlaygroundEnvironment(import.meta.url);

testDevAndDeploy("renders page with styled content", async ({ page, url }) => {
  await page.goto(url);

  const getPageContent = () => page.content();

  await poll(async () => {
    const content = await getPageContent();
    expect(content).toContain("FOUC Repro");
    return true;
  });
});

testDeploy(
  "production HTML includes stylesheet link to prevent FOUC",
  async ({ page, url }) => {
    // We disable JS so the page renders only the server-sent HTML.
    // This lets us assert that the <link rel="stylesheet"> is present in the
    // initial SSR response, which is what actually prevents FOUC -- if it only
    // appears after JS hydration, the browser paints unstyled content first.
    await page.setJavaScriptEnabled(false);
    await page.goto(url);

    const content = await page.content();

    // The server-rendered HTML must contain a stylesheet link pointing to a
    // hashed CSS asset. This is the FOUC prevention invariant: the browser
    // must discover the CSS before first paint, without relying on client JS.
    expect(content).toMatch(/<link[^>]+rel="stylesheet"[^>]+href="[^"]*\.css"/);
  },
);
