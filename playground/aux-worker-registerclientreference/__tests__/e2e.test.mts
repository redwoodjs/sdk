import { poll, setupPlaygroundEnvironment, testDevAndDeploy } from "rwsdk/e2e";
import { describe, expect } from "vitest";

setupPlaygroundEnvironment(import.meta.url);

describe("Auxiliary worker + node_modules 'use client'", () => {
  testDevAndDeploy(
    "dev server boots and renders the page",
    async ({ page, url }) => {
      await page.goto(url);

      await poll(async () => {
        const text = await page.$eval("h1", (el) => el.textContent);
        expect(text).toBe("Issue #1259 Repro");
        return true;
      });
    },
  );
});
