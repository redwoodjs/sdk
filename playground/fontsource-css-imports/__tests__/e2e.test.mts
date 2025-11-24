import {
  poll,
  setupPlaygroundEnvironment,
  testDevAndDeploy,
  waitForHydration,
} from "rwsdk/e2e";
import { expect } from "vitest";

setupPlaygroundEnvironment(import.meta.url);

testDevAndDeploy("renders page with font imports", async ({ page, url }) => {
  await page.goto(url);

  const getPageContent = () => page.content();

  await poll(async () => {
    const content = await getPageContent();
    expect(content).toContain("Hello World");
    return true;
  });
});

testDevAndDeploy(
  "verifies font files are accessible",
  async ({ page, url }) => {
    const fontResponses: Array<{ url: string; status: number }> = [];

    page.on("response", (response) => {
      const responseUrl = response.url();
      if (
        responseUrl.includes(".woff") ||
        responseUrl.includes(".woff2") ||
        responseUrl.includes("figtree")
      ) {
        fontResponses.push({
          url: responseUrl,
          status: response.status(),
        });
      }
    });

    await page.goto(url);
    await waitForHydration(page);

    const getH1 = () => page.waitForSelector("h1");
    const getComputedFontFamily = async () => {
      const h1 = await getH1();
      return h1
        ? await page.evaluate(
            (el) => window.getComputedStyle(el).fontFamily,
            h1,
          )
        : null;
    };

    await poll(async () => {
      const fontFamily = await getComputedFontFamily();
      expect(fontFamily).toContain("Figtree");
      return true;
    });

    await poll(async () => {
      const fontFailures = fontResponses.filter((r) => r.status >= 400);
      const fontSuccesses = fontResponses.filter((r) => r.status < 400);

      if (fontFailures.length > 0) {
        throw new Error(`Font loading failed: ${fontFailures.join(", ")}`);
      }

      expect(fontSuccesses.length).toBeGreaterThan(0);
      return true;
    });
  },
);
