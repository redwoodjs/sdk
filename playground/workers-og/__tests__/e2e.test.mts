import fs from "fs-extra";
import path from "node:path";
import { poll, setupPlaygroundEnvironment, testDevAndDeploy } from "rwsdk/e2e";
import { expect } from "vitest";

setupPlaygroundEnvironment(import.meta.url);

testDevAndDeploy(
  "WASM files are present in worker assets",
  async ({ projectDir }) => {
    const workerAssetsDir = path.join(projectDir, "dist", "worker", "assets");

    const wasmFiles = await fs.readdir(workerAssetsDir).catch(() => []);
    const wasmFilesFiltered = wasmFiles.filter((file) =>
      file.endsWith(".wasm"),
    );

    expect(wasmFilesFiltered.length).toBeGreaterThan(0);
  },
);

testDevAndDeploy("OG image generation works", async ({ page, url }) => {
  await page.goto(`${url}/og`);

  await poll(async () => {
    const response = await page.goto(`${url}/og`);
    expect(response?.status()).toBe(200);
    const contentType = response?.headers()["content-type"];
    expect(contentType).toContain("image");
    return true;
  });
});
