import { execFile } from "node:child_process";
import { access, readFile, realpath, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createRequire } from "node:module";
import { promisify } from "node:util";
import { expect, test } from "vitest";

const execFileAsync = promisify(execFile);
const repoRoot = resolve(import.meta.dirname, "../../..");

const apps = {
  css: {
    root: resolve(repoRoot, "playground", "css"),
    ownMarker: "FOUC Repro",
    foreignMarker: "navigate-to-about",
  },
  clientNavigation: {
    root: resolve(repoRoot, "playground", "client-navigation"),
    ownMarker: "navigate-to-about",
    foreignMarker: "FOUC Repro",
  },
};

const buildApp = async (appRoot: string) => {
  const requireFromApp = createRequire(resolve(appRoot, "package.json"));
  const viteEntry = resolve(
    dirname(requireFromApp.resolve("vite")),
    "..",
    "..",
    "bin",
    "vite.js",
  );

  return execFileAsync(process.execPath, [viteEntry, "build"], {
    cwd: appRoot,
    env: {
      ...process.env,
      NO_COLOR: "1",
    },
    maxBuffer: 10 * 1024 * 1024,
  });
};

// context(chrisvdm, 2026-09-12): Two real playground applications reproduce
// the package-manager layout from issue #1290: distinct app folders resolve one
// physical SDK while their production builds overlap in time.
test("concurrent applications sharing one SDK keep their build code isolated", async () => {
  const resolvedSdkEntries = await Promise.all(
    Object.values(apps).map(async ({ root }) => {
      const requireFromApp = createRequire(resolve(root, "package.json"));
      return realpath(requireFromApp.resolve("rwsdk/vite"));
    }),
  );
  expect(new Set(resolvedSdkEntries).size).toBe(1);

  await Promise.all(
    Object.values(apps).map(({ root }) =>
      rm(
        resolve(
          root,
          "node_modules",
          ".cache",
          "rwsdk",
          "__intermediate_builds",
        ),
        { recursive: true, force: true },
      ),
    ),
  );

  await Promise.all(Object.values(apps).map(({ root }) => buildApp(root)));

  for (const { root, ownMarker, foreignMarker } of Object.values(apps)) {
    const bridgePath = resolve(
      root,
      "node_modules",
      ".cache",
      "rwsdk",
      "__intermediate_builds",
      "ssr",
      "ssr_bridge.js",
    );
    await expect(access(bridgePath)).resolves.toBeUndefined();

    const worker = await readFile(resolve(root, "dist", "worker", "index.js"), {
      encoding: "utf8",
    });
    expect(worker).toContain(ownMarker);
    expect(worker).not.toContain(foreignMarker);
  }
});
