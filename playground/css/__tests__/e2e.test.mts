import { readFile, writeFile } from "fs/promises";
import { join } from "path";
import {
  poll,
  setupPlaygroundEnvironment,
  testDev,
  testDeploy,
  testDevAndDeploy,
  waitForHydration,
} from "rwsdk/e2e";
import { expect } from "vitest";

setupPlaygroundEnvironment(import.meta.url);

testDev(
  "keeps a client component's CSS Module class after editing the CSS and reloading",
  async ({ page, url, projectDir }) => {
    const cssPath = join(projectDir, "src/app/pages/Welcome.module.css");
    const originalCss = await readFile(cssPath, "utf8");
    const editedCss = originalCss.replace(
      "background: rgb(0, 0, 255)",
      "background: rgb(0, 128, 0)",
    );

    const readStyles = () =>
      page.$eval("#hydrate-root > div", (element) => ({
        bodyBackground: getComputedStyle(document.body).backgroundColor,
        className: element.className,
        containerBackground: getComputedStyle(element).backgroundColor,
      }));

    try {
      await page.goto(url, { waitUntil: "domcontentloaded" });
      await page.waitForSelector("#hydrate-root > div");
      await waitForHydration(page);
      await page.waitForFunction(
        () =>
          getComputedStyle(document.querySelector("#hydrate-root > div")!)
            .backgroundColor === "rgb(0, 0, 255)",
      );

      const before = await readStyles();
      console.log("issue-1266 before CSS edit", before);
      expect(before).toMatchObject({
        bodyBackground: "rgb(240, 240, 240)",
        containerBackground: "rgb(0, 0, 255)",
      });

      await writeFile(cssPath, editedCss);
      await page.waitForFunction(
        () =>
          getComputedStyle(document.querySelector("#hydrate-root > div")!)
            .backgroundColor === "rgb(0, 128, 0)",
      );
      const afterHotUpdate = await readStyles();
      console.log("issue-1266 after CSS edit before reload", afterHotUpdate);
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForSelector("#hydrate-root > div");

      const after = await readStyles();
      console.log("issue-1266 after CSS edit and reload", after);
      expect(after).toMatchObject({
        bodyBackground: "rgb(240, 240, 240)",
        containerBackground: "rgb(0, 128, 0)",
      });
    } finally {
      await writeFile(cssPath, originalCss);
    }
  },
);

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
