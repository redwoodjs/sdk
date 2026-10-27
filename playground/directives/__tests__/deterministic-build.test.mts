import { execFile } from "node:child_process";
import { rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, relative, resolve } from "node:path";
import { promisify } from "node:util";
import { getFilesRecursively } from "rwsdk/e2e";
import { expect, test } from "vitest";

const execFileAsync = promisify(execFile);
const projectDir = resolve(import.meta.dirname, "..");
const requireFromProject = createRequire(resolve(projectDir, "package.json"));
const viteEntry = resolve(
  dirname(requireFromProject.resolve("vite")),
  "..",
  "..",
  "bin",
  "vite.js",
);

const buildAndListClientAssets = async () => {
  // context(chrisvdm, 2026-10-27): A clean production build verifies that
  // directive discovery order cannot leak into content-derived asset names.
  await rm(resolve(projectDir, "dist"), { recursive: true, force: true });
  await rm(resolve(projectDir, "node_modules", ".cache", "rwsdk"), {
    recursive: true,
    force: true,
  });

  await execFileAsync(process.execPath, [viteEntry, "build"], {
    cwd: projectDir,
    env: { ...process.env, NO_COLOR: "1" },
    maxBuffer: 10 * 1024 * 1024,
  });

  const assetsDir = resolve(projectDir, "dist", "client", "assets");
  const assetFiles = await getFilesRecursively(assetsDir);
  return assetFiles.map((file) => relative(assetsDir, file)).sort();
};

test("identical production builds emit the same client asset filenames", async () => {
  const firstBuildAssets = await buildAndListClientAssets();
  const secondBuildAssets = await buildAndListClientAssets();

  expect(firstBuildAssets.length).toBeGreaterThan(0);
  expect(secondBuildAssets).toEqual(firstBuildAssets);
});
