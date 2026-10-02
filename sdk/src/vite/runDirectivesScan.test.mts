import { realpathSync } from "node:fs";
import {
  mkdir,
  mkdtemp,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BuildEnvironment, resolveConfig } from "vite";
import { describe, expect, it, test, vi } from "vitest";
import {
  classifyModule,
  resolveModuleWithEnvironment,
  runDirectivesScan,
} from "./runDirectivesScan.mjs";

const appTopLevelDir = realpathSync(tmpdir()).split(path.sep)[1];
const packageTopLevelDir = fileURLToPath(import.meta.url).split(path.sep)[1];

describe("runDirectivesScan helpers", () => {
  describe("resolveModuleWithEnvironment", () => {
    it("should use the client resolver when importerEnv is 'client'", async () => {
      const clientResolver = vi.fn((_a, _b, _c, _d, cb) =>
        cb(null, "/resolved/client"),
      );
      const workerResolver = vi.fn();

      const result = await resolveModuleWithEnvironment({
        path: "test-path",
        importerEnv: "client",
        clientResolver,
        workerResolver,
      });

      expect(clientResolver).toHaveBeenCalled();
      expect(workerResolver).not.toHaveBeenCalled();
      expect(result).toEqual({ id: "/resolved/client" });
    });

    it("should use the worker resolver when importerEnv is 'worker'", async () => {
      const clientResolver = vi.fn();
      const workerResolver = vi.fn((_a, _b, _c, _d, cb) =>
        cb(null, "/resolved/worker"),
      );

      const result = await resolveModuleWithEnvironment({
        path: "test-path",
        importerEnv: "worker",
        clientResolver,
        workerResolver,
      });

      expect(workerResolver).toHaveBeenCalled();
      expect(clientResolver).not.toHaveBeenCalled();
      expect(result).toEqual({ id: "/resolved/worker" });
    });

    it("should return null on resolution error", async () => {
      const clientResolver = vi.fn((_a, _b, _c, _d, cb) =>
        cb(new Error("Resolution failed")),
      );
      const workerResolver = vi.fn();

      const result = await resolveModuleWithEnvironment({
        path: "test-path",
        importerEnv: "client",
        clientResolver,
        workerResolver,
      });

      expect(result).toBeNull();
    });
  });

  describe("classifyModule", () => {
    it("should return 'client' if 'use client' directive is present", () => {
      const contents = `'use client';\nconsole.log('hello');`;
      const result = classifyModule({ contents, inheritedEnv: "worker" });
      expect(result.moduleEnv).toBe("client");
      expect(result.isClient).toBe(true);
      expect(result.isServer).toBe(false);
    });

    it("should return 'worker' if 'use server' directive is present", () => {
      const contents = `"use server";\nexport default () => {};`;
      const result = classifyModule({ contents, inheritedEnv: "client" });
      expect(result.moduleEnv).toBe("worker");
      expect(result.isClient).toBe(false);
      expect(result.isServer).toBe(true);
    });

    it("should prioritize 'use client' over 'use server'", () => {
      const contents = `'use client';\n'use server';\nconsole.log('hello');`;
      const result = classifyModule({ contents, inheritedEnv: "worker" });
      expect(result.moduleEnv).toBe("client");
      expect(result.isClient).toBe(true);
      expect(result.isServer).toBe(false);
    });

    it("should return the inherited environment if no directive is present", () => {
      const contents = `console.log('no directive');`;
      const result = classifyModule({ contents, inheritedEnv: "worker" });
      expect(result.moduleEnv).toBe("worker");
      expect(result.isClient).toBe(false);
      expect(result.isServer).toBe(false);
    });
  });
});

// context(chrisvdm, 2026-09-26): A linked package can resolve outside the
// app's top-level directory, so the scanner must preserve Vite's filesystem
// result instead of interpreting it as a Vite-style path beneath the app.
test.runIf(
  process.platform !== "win32" && appTopLevelDir !== packageTopLevelDir,
)(
  "scans a linked dependency outside the app's top-level directory",
  async () => {
    const appRoot = await realpath(
      await mkdtemp(path.join(tmpdir(), "rwsdk-path-repro-app-")),
    );
    const packageRoot = await realpath(
      await mkdtemp(
        fileURLToPath(new URL("./rwsdk-path-repro-package-", import.meta.url)),
      ),
    );

    try {
      await mkdir(path.join(appRoot, "src"), { recursive: true });
      await mkdir(path.join(appRoot, "node_modules"), { recursive: true });

      await writeFile(
        path.join(packageRoot, "package.json"),
        JSON.stringify({
          name: "external-directives",
          type: "module",
          exports: {
            "./client": "./client.js",
            "./server": "./server.js",
          },
        }),
      );

      const clientPath = path.join(packageRoot, "client.js");
      const serverPath = path.join(packageRoot, "server.js");
      await writeFile(clientPath, '"use client"; export const client = 1;');
      await writeFile(
        serverPath,
        '"use server"; export async function server() {}',
      );

      await symlink(
        packageRoot,
        path.join(appRoot, "node_modules", "external-directives"),
        "junction",
      );
      await writeFile(
        path.join(appRoot, "src", "worker.js"),
        [
          'import "external-directives/client";',
          'import "external-directives/server";',
        ].join("\n"),
      );

      const rootConfig = await resolveConfig(
        {
          root: appRoot,
          configFile: false,
          environments: { worker: {} },
        },
        "build",
      );
      const clientFiles = new Set<string>();
      const serverFiles = new Set<string>();

      await runDirectivesScan({
        rootConfig,
        environments: {
          client: new BuildEnvironment("client", rootConfig),
          worker: new BuildEnvironment("worker", rootConfig),
        },
        clientFiles,
        serverFiles,
        entries: [path.join(appRoot, "src", "worker.js")],
        esbuildOptions: {},
        directiveScanOutDir: path.join(appRoot, ".directive-scan"),
      });

      expect([...clientFiles]).toEqual([clientPath]);
      expect([...serverFiles]).toEqual([serverPath]);
    } finally {
      await rm(appRoot, { recursive: true, force: true });
      await rm(packageRoot, { recursive: true, force: true });
    }
  },
);
