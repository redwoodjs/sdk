import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, test } from "vitest";
import { getBrowserEndpointPath } from "rwsdk/e2e/setup";
import { acquireBrowser } from "../../../sdk/dist/lib/e2e/browserConnection.mjs";

test("runners connect to the setup browser and release only their own connection", async () => {
  const endpoint = await readFile(await getBrowserEndpointPath(), "utf8");
  const first = await acquireBrowser();
  const second = await acquireBrowser();
  try {
    expect(first.browser.wsEndpoint()).toBe(endpoint);
    expect(second.browser.wsEndpoint()).toBe(endpoint);
    expect(first.browser.process()).toBeNull();
    await first.release();
    const page = await second.browser.newPage();
    try {
      await page.setContent("<h1>Shared browser still running</h1>");
      expect(await page.title()).toBe("");
      expect(await page.content()).toContain("Shared browser still running");
    } finally {
      await page.close();
    }
  } finally {
    await first.release();
    await second.release();
  }
});

test("a runner without a shared browser closes the browser it launches", async () => {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "rwsdk-browser-test-"),
  );
  try {
    const connection = await acquireBrowser(
      path.join(directory, "missing-endpoint"),
    );
    const child = connection.browser.process();
    try {
      expect(child).not.toBeNull();
      expect(child?.exitCode).toBeNull();
    } finally {
      await connection.release();
    }
    expect(child?.exitCode).toBe(0);
    expect(child?.stdout?.destroyed).toBe(true);
    expect(child?.stderr?.destroyed).toBe(true);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
