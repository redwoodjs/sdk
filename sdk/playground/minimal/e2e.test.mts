import { describe, it, expect } from "vitest";
import { setupTestEnvironment } from "@redwoodjs/sdk/e2e/environment";
import { runDevServer } from "@redwoodjs/sdk/e2e/dev";
import { launchBrowser } from "@redwoodjs/sdk/e2e/browser";

describe("minimal playground", () => {
  it("dev server should respond with hello world", async () => {
    const resources = await setupTestEnvironment({
      projectDir: __dirname,
      sync: true,
    });

    let devServer: { url: string; stopDev: () => Promise<void> } | undefined;
    let browser: import("puppeteer-core").Browser | undefined;

    try {
      devServer = await runDevServer("pnpm", resources.targetDir);

      browser = await launchBrowser();
      const page = await browser.newPage();
      await page.goto(devServer.url);
      const content = await page.content();
      expect(content).toContain("Hello World");
    } finally {
      await browser?.close();
      await devServer?.stopDev();
      await resources.tempDirCleanup?.();
    }
  });
});
