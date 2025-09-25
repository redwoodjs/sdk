import { describe, expect } from "vitest";
import {
  setupPlaygroundEnvironment,
  testDevAndDeploy,
  testDev,
  poll,
  getPlaygroundEnvironment,
  waitForHydration,
} from "rwsdk/e2e";
import fs from "fs-extra";
import path from "node:path";

setupPlaygroundEnvironment(import.meta.url);

describe("CSS Handling", () => {
  describe("Rendering", () => {
    testDevAndDeploy(
      "should apply styles from Document.tsx link",
      async ({ page, url }) => {
        const getBackgroundColor = (selector: string) => {
          return page.$eval(selector, (el) => {
            return window.getComputedStyle(el).backgroundColor;
          });
        };

        await page.goto(url);
        await waitForHydration(page);

        await poll(async () => {
          const backgroundColor = await getBackgroundColor(
            '[data-testid="main-content"]',
          );
          expect(backgroundColor).toBe("rgb(255, 0, 0)");
          return true;
        });
      },
    );

    testDevAndDeploy(
      "should apply styles from CSS Modules",
      async ({ page, url }) => {
        const getBackgroundColor = (selector: string) => {
          return page.$eval(selector, (el) => {
            return window.getComputedStyle(el).backgroundColor;
          });
        };

        await page.goto(`${url}/css-modules`);
        await waitForHydration(page);

        await poll(async () => {
          const backgroundColor = await getBackgroundColor(
            '[data-testid="css-module-content"]',
          );
          expect(backgroundColor).toBe("rgb(0, 0, 255)");
          return true;
        });
      },
    );

    testDevAndDeploy(
      "should apply styles from side-effect CSS import",
      async ({ page, url }) => {
        const getBackgroundColor = (selector: string) => {
          return page.$eval(selector, (el) => {
            return window.getComputedStyle(el).backgroundColor;
          });
        };

        await page.goto(`${url}/side-effect-css`);
        await waitForHydration(page);

        await poll(async () => {
          const backgroundColor = await getBackgroundColor(
            '[data-testid="side-effect-content"]',
          );
          expect(backgroundColor).toBe("rgb(0, 128, 0)");
          return true;
        });
      },
    );
  });

  describe("HMR", () => {
    testDev(
      "should update styles from Document.tsx link on change",
      async ({ page, url, projectDir }) => {
        const getBackgroundColor = (selector: string) => {
          return page.$eval(selector, (el) => {
            return window.getComputedStyle(el).backgroundColor;
          });
        };

        const cssPath = path.join(projectDir, "src", "app", "globals.css");

        await page.goto(url);
        await waitForHydration(page);

        await poll(async () => {
          const backgroundColor = await getBackgroundColor(
            '[data-testid="main-content"]',
          );
          expect(backgroundColor).toBe("rgb(255, 0, 0)");
          return true;
        });

        const cssContent = await fs.readFile(cssPath, "utf-8");
        await fs.writeFile(
          cssPath,
          cssContent.replace("rgb(255, 0, 0)", "rgb(255, 165, 0)"),
        );

        await poll(async () => {
          const backgroundColor = await getBackgroundColor(
            '[data-testid="main-content"]',
          );
          return backgroundColor === "rgb(255, 165, 0)";
        });
      },
    );

    testDev(
      "should update styles from CSS Modules on change",
      async ({ page, url, projectDir }) => {
        const getBackgroundColor = (selector: string) => {
          return page.$eval(selector, (el) => {
            return window.getComputedStyle(el).backgroundColor;
          });
        };

        const cssPath = path.join(
          projectDir,
          "src",
          "app",
          "components",
          "CssModuleComponent.module.css",
        );

        await page.goto(`${url}/css-modules`);
        await waitForHydration(page);

        await poll(async () => {
          const backgroundColor = await getBackgroundColor(
            '[data-testid="css-module-content"]',
          );
          expect(backgroundColor).toBe("rgb(0, 0, 255)");
          return true;
        });

        const cssContent = await fs.readFile(cssPath, "utf-8");
        await fs.writeFile(
          cssPath,
          cssContent.replace("rgb(0, 0, 255)", "rgb(75, 0, 130)"),
        );

        await poll(async () => {
          const backgroundColor = await getBackgroundColor(
            '[data-testid="css-module-content"]',
          );
          return backgroundColor === "rgb(75, 0, 130)";
        });
      },
    );

    testDev(
      "should update styles from side-effect CSS on change",
      async ({ page, url, projectDir }) => {
        const getBackgroundColor = (selector: string) => {
          return page.$eval(selector, (el) => {
            return window.getComputedStyle(el).backgroundColor;
          });
        };

        const cssPath = path.join(
          projectDir,
          "src",
          "app",
          "components",
          "SideEffectCssComponent.css",
        );

        await page.goto(`${url}/side-effect-css`);
        await waitForHydration(page);

        await poll(async () => {
          const backgroundColor = await getBackgroundColor(
            '[data-testid="side-effect-content"]',
          );
          expect(backgroundColor).toBe("rgb(0, 128, 0)");
          return true;
        });

        const cssContent = await fs.readFile(cssPath, "utf-8");
        await fs.writeFile(
          cssPath,
          cssContent.replace("rgb(0, 128, 0)", "rgb(255, 255, 0)"),
        );

        await poll(async () => {
          const backgroundColor = await getBackgroundColor(
            '[data-testid="side-effect-content"]',
          );
          return backgroundColor === "rgb(255, 255, 0)";
        });
      },
    );
  });
});
