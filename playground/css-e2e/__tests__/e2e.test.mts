import { describe, expect } from "vitest";
import {
  setupPlaygroundEnvironment,
  testDevAndDeploy,
  testDev,
  poll,
  getPlaygroundEnvironment,
} from "rwsdk/e2e";
import fs from "fs-extra";
import path from "node:path";
import type { Page } from "puppeteer-core";

setupPlaygroundEnvironment(import.meta.url);

const getBackgroundColor = (page: Page, selector: string) => {
  return page.$eval(selector, (el) => {
    return window.getComputedStyle(el).backgroundColor;
  });
};

describe("CSS Handling", () => {
  describe("Rendering", () => {
    testDevAndDeploy(
      "should apply styles from Document.tsx link",
      async ({ page, url }) => {
        await page.goto(url);
        const backgroundColor = await getBackgroundColor(
          page,
          '[data-testid="main-content"]',
        );
        expect(backgroundColor).toBe("rgb(255, 0, 0)");
      },
    );

    testDevAndDeploy(
      "should apply styles from CSS Modules",
      async ({ page, url }) => {
        await page.goto(`${url}/css-modules`);
        const backgroundColor = await getBackgroundColor(
          page,
          '[data-testid="css-module-content"]',
        );
        expect(backgroundColor).toBe("rgb(0, 0, 255)");
      },
    );

    testDevAndDeploy(
      "should apply styles from side-effect CSS import",
      async ({ page, url }) => {
        await page.goto(`${url}/side-effect-css`);
        const backgroundColor = await getBackgroundColor(
          page,
          '[data-testid="side-effect-content"]',
        );
        expect(backgroundColor).toBe("rgb(0, 128, 0)");
      },
    );
  });

  describe("HMR", () => {
    testDev(
      "should update styles from Document.tsx link on change",
      async ({ page, url }) => {
        const { projectDir } = getPlaygroundEnvironment();
        const cssPath = path.join(projectDir, "src", "app", "globals.css");

        await page.goto(url);
        expect(
          await getBackgroundColor(page, '[data-testid="main-content"]'),
        ).toBe("rgb(255, 0, 0)");

        const cssContent = await fs.readFile(cssPath, "utf-8");
        await fs.writeFile(
          cssPath,
          cssContent.replace("rgb(255, 0, 0)", "rgb(255, 165, 0)"),
        );

        await poll(async () => {
          const backgroundColor = await getBackgroundColor(
            page,
            '[data-testid="main-content"]',
          );
          return backgroundColor === "rgb(255, 165, 0)";
        });
      },
    );

    testDev(
      "should update styles from CSS Modules on change",
      async ({ page, url }) => {
        const { projectDir } = getPlaygroundEnvironment();
        const cssPath = path.join(
          projectDir,
          "src",
          "app",
          "components",
          "CssModuleComponent.module.css",
        );

        await page.goto(`${url}/css-modules`);
        expect(
          await getBackgroundColor(page, '[data-testid="css-module-content"]'),
        ).toBe("rgb(0, 0, 255)");

        const cssContent = await fs.readFile(cssPath, "utf-8");
        await fs.writeFile(
          cssPath,
          cssContent.replace("rgb(0, 0, 255)", "rgb(75, 0, 130)"),
        );

        await poll(async () => {
          const backgroundColor = await getBackgroundColor(
            page,
            '[data-testid="css-module-content"]',
          );
          return backgroundColor === "rgb(75, 0, 130)";
        });
      },
    );

    testDev(
      "should update styles from side-effect CSS on change",
      async ({ page, url }) => {
        const { projectDir } = getPlaygroundEnvironment();
        const cssPath = path.join(
          projectDir,
          "src",
          "app",
          "components",
          "SideEffectCssComponent.css",
        );

        await page.goto(`${url}/side-effect-css`);
        expect(
          await getBackgroundColor(page, '[data-testid="side-effect-content"]'),
        ).toBe("rgb(0, 128, 0)");

        const cssContent = await fs.readFile(cssPath, "utf-8");
        await fs.writeFile(
          cssPath,
          cssContent.replace("rgb(0, 128, 0)", "rgb(255, 255, 0)"),
        );

        await poll(async () => {
          const backgroundColor = await getBackgroundColor(
            page,
            '[data-testid="side-effect-content"]',
          );
          return backgroundColor === "rgb(255, 255, 0)";
        });
      },
    );
  });
});
