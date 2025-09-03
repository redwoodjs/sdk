// @ts-ignore
import { OnLoadArgs, OnResolveArgs, Plugin, PluginBuild } from "esbuild";
import { Environment, ResolvedConfig } from "vite";
import fsp from "node:fs/promises";
import { hasDirective } from "./hasDirective.mjs";
import path from "node:path";
import debug from "debug";
import { getViteEsbuild } from "./getViteEsbuild.mjs";
import { normalizeModulePath } from "../lib/normalizeModulePath.mjs";
import { createIdResolver } from "vite";

const log = debug("rwsdk:vite:run-directives-scan");

// Copied from Vite's source code.
// https://github.com/vitejs/vite/blob/main/packages/vite/src/shared/utils.ts
const isObject = (value: unknown): value is Record<string, any> =>
  Object.prototype.toString.call(value) === "[object Object]";

// Copied from Vite's source code.
// https://github.com/vitejs/vite/blob/main/packages/vite/src/node/utils.ts
const externalRE = /^(https?:)?\/\//;
const isExternalUrl = (url: string): boolean => externalRE.test(url);

export const runDirectivesScan = async ({
  rootConfig,
  environment,
  clientFiles,
  serverFiles,
}: {
  rootConfig: ResolvedConfig;
  environment: Environment;
  clientFiles: Set<string>;
  serverFiles: Set<string>;
}) => {
  const esbuild = await getViteEsbuild(rootConfig.root);
  const input = environment.config.build.rollupOptions?.input;
  let entries: string[];

  if (Array.isArray(input)) {
    entries = input;
  } else if (typeof input === "string") {
    entries = [input];
  } else if (isObject(input)) {
    entries = Object.values(input);
  } else {
    entries = [];
  }

  if (entries.length === 0) {
    log(
      "No entries found for directives scan in environment '%s', skipping.",
      environment.name,
    );
    return;
  }

  const absoluteEntries = entries.map((entry) =>
    path.resolve(rootConfig.root, entry),
  );

  log(
    "Starting directives scan for environment '%s' with entries:",
    environment.name,
    absoluteEntries,
  );

  const resolveId = createIdResolver(rootConfig, { scan: true });

  const esbuildScanPlugin: Plugin = {
    name: "rwsdk:esbuild-scan-plugin",
    setup(build: PluginBuild) {
      // Match Vite's behavior by externalizing assets and special queries.
      // This prevents esbuild from trying to bundle them, which would fail.
      const scriptFilter = /\.(c|m)?[jt]sx?$/;
      const specialQueryFilter = /[?&](?:url|raw|worker|sharedworker|inline)\b/;
      // This regex is used to identify if a path has any file extension.
      const hasExtensionRegex = /\.[^/]+$/;

      build.onResolve({ filter: specialQueryFilter }, (args: OnResolveArgs) => {
        log("Externalizing special query:", args.path);
        return { external: true };
      });

      build.onResolve(
        { filter: /.*/, namespace: "file" },
        (args: OnResolveArgs) => {
          // Externalize if the path has an extension AND that extension is not a
          // script extension. Extensionless paths are assumed to be scripts and
          // are allowed to pass through for resolution.
          if (
            hasExtensionRegex.test(args.path) &&
            !scriptFilter.test(args.path)
          ) {
            log("Externalizing non-script import:", args.path);
            return { external: true };
          }
        },
      );

      build.onResolve({ filter: /.*/ }, async (args: OnResolveArgs) => {
        // Prevent infinite recursion.
        if (args.pluginData?.rwsdkScanResolver) {
          return null;
        }

        const resolvedPath = await resolveId(
          environment,
          args.path,
          args.importer,
        );

        if (resolvedPath && path.isAbsolute(resolvedPath)) {
          const resolved = await build.resolve(resolvedPath, {
            importer: args.importer,
            resolveDir: args.resolveDir,
            kind: args.kind,
            pluginData: { rwsdkScanResolver: true },
          });

          if (resolved.errors.length === 0) {
            return resolved;
          }
        }

        // Fallback to esbuild's default resolver if Vite couldn't resolve or
        // if the path is not absolute (e.g., a builtin).
        const resolved = await build.resolve(args.path, {
          importer: args.importer,
          resolveDir: args.resolveDir,
          kind: args.kind,
          pluginData: { rwsdkScanResolver: true },
        });

        if (resolved.errors.length > 0) {
          log(
            "Could not resolve '%s'. Marking as external. Errors: %s",
            args.path,
            resolved.errors.map((e: any) => e.text).join(", "),
          );
          return { external: true };
        }

        return resolved;
      });

      build.onLoad({ filter: /\.(m|c)?[jt]sx?$/ }, async (args: OnLoadArgs) => {
        if (
          !args.path.startsWith("/") ||
          args.path.includes("virtual:") ||
          isExternalUrl(args.path)
        ) {
          return null;
        }

        try {
          const contents = await fsp.readFile(args.path, "utf-8");
          if (hasDirective(contents, "use client")) {
            log("Discovered 'use client' in:", args.path);
            clientFiles.add(normalizeModulePath(args.path, rootConfig.root));
          }
          if (hasDirective(contents, "use server")) {
            log("Discovered 'use server' in:", args.path);
            serverFiles.add(normalizeModulePath(args.path, rootConfig.root));
          }
          return { contents, loader: "default" };
        } catch (e) {
          log("Could not read file during scan, skipping:", args.path, e);
          return null;
        }
      });
    },
  };

  try {
    await esbuild.build({
      entryPoints: absoluteEntries,
      bundle: true,
      write: false,
      platform: "node",
      format: "esm",
      logLevel: "silent",
      plugins: [esbuildScanPlugin],
    });
  } catch (e: any) {
    throw new Error(`RWSDK directive scan failed:\n${e.message}`);
  }
};
