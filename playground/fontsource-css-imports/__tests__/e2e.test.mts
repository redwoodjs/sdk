import { poll, setupPlaygroundEnvironment, testDevAndDeploy } from "rwsdk/e2e";
import { expect } from "vitest";

setupPlaygroundEnvironment(import.meta.url);

testDevAndDeploy("renders page with font imports", async ({ page, url }) => {
  await page.goto(url);

  await page.waitForFunction("document.readyState === 'complete'");

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

    await page.waitForFunction("document.readyState === 'complete'");

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

    await page.waitForTimeout(2000);

    if (fontFailures.length > 0) {
      console.error("Font loading failures:", fontFailures);
    }

    const computedStyle = await page.evaluate(() => {
      const h1 = document.querySelector("h1");
      return h1 ? window.getComputedStyle(h1).fontFamily : null;
    });

    expect(computedStyle).toContain("Figtree");
  },
);
