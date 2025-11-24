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
    await page.goto(url);

    const fontFailures: string[] = [];

    page.on("response", (response) => {
      const url = response.url();
      if (
        url.includes(".woff") ||
        url.includes(".woff2") ||
        url.includes("figtree")
      ) {
        if (response.status() >= 400) {
          fontFailures.push(`${url}: ${response.status()}`);
        }
      }
    });

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

    if (fontFailures.length > 0) {
      console.error("Font loading failures:", fontFailures);
      throw new Error(`Font loading failed: ${fontFailures.join(", ")}`);
    }
  },
);
