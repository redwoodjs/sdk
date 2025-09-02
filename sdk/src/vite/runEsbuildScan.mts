// @ts-ignore
import esbuild, { OnLoadArgs, OnResolveArgs, PluginBuild } from "esbuild";

import { Alias, ResolvedConfig, normalizePath } from "vite";
import fsp from "node:fs/promises";
import { hasDirective } from "./hasDirective.mjs";
import path from "node:path";
import debug from "debug";
import { ensureAliasArray } from "./ensureAliasArray.mjs";
import { getViteEsbuild } from "./getViteEsbuild.mjs";

const log = debug("rwsdk:vite:esbuild-scan");

// Copied from Vite's source code.
// https://github.com/vitejs/vite/blob/main/packages/vite/src/shared/utils.ts
const isObject = (value: unknown): value is Record<string, any> =>
  Object.prototype.toString.call(value) === "[object Object]";

// Copied from Vite's source code.
// https://github.com/vitejs/vite/blob/main/packages/vite/src/node/utils.ts
const externalRE = /^(https?:)?\/\//;
const isExternalUrl = (url: string): boolean => externalRE.test(url);

function createEsbuildScanPlugin({
  clientFiles,
  serverFiles,
  aliases,
}: {
  clientFiles: Set<string>;
  serverFiles: Set<string>;
  aliases: Alias[];
}) {
  return {
    name: "rwsdk:esbuild-scan-plugin",
    setup(build: PluginBuild) {
      build.onResolve({ filter: /.*/ }, async (args: OnResolveArgs) => {
        // Prevent infinite recursion.
        if (args.pluginData?.rwsdkScanResolver) {
          return null;
        }

        // 1. First, try to resolve aliases.
        for (const { find, replacement } of aliases) {
          const findPattern =
            find instanceof RegExp ? find : new RegExp(`^${find}(\\/.*)?$`);

          if (findPattern.test(args.path)) {
            const newPath = args.path.replace(findPattern, replacement);

            const resolved = await build.resolve(newPath, {
              importer: args.importer,
              resolveDir: args.resolveDir,
              kind: args.kind,
              pluginData: { rwsdkScanResolver: true },
            });

            if (resolved.errors.length === 0) {
              return resolved;
            }

            log(
              "Could not resolve aliased path '%s' (from '%s'). Marking as external. Errors: %s",
              newPath,
              args.path,
              resolved.errors.map((e: any) => e.text).join(", "),
            );
            return { external: true };
          }
        }

        // 2. If no alias matches, try esbuild's default resolver.
        const resolved = await build.resolve(args.path, {
          importer: args.importer,
          resolveDir: args.resolveDir,
          kind: args.kind,
          pluginData: { rwsdkScanResolver: true },
        });

        // If it fails, mark as external but don't crash.
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
            clientFiles.add(normalizePath(args.path));
          }
          if (hasDirective(contents, "use server")) {
            log("Discovered 'use server' in:", args.path);
            serverFiles.add(normalizePath(args.path));
          }
          return { contents, loader: "default" };
        } catch (e) {
          log("Could not read file during scan, skipping:", args.path, e);
          return null;
        }
      });
    },
  };
}

export async function runEsbuildScan({
  rootConfig,
  envName,
  clientFiles,
  serverFiles,
}: {
  rootConfig: ResolvedConfig;
  envName: string;
  clientFiles: Set<string>;
  serverFiles: Set<string>;
}) {
  const esbuild = await getViteEsbuild(rootConfig.root);
  const env = rootConfig.environments[envName];
  const input = env.build.rollupOptions?.input;
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
      "No entries found for esbuild scan in environment '%s', skipping.",
      envName,
    );
    return;
  }

  const absoluteEntries = entries.map((entry) =>
    path.resolve(rootConfig.root, entry),
  );

  log(
    "Starting esbuild scan for environment '%s' with entries:",
    envName,
    absoluteEntries,
  );

  try {
    await esbuild.build({
      entryPoints: absoluteEntries,
      bundle: true,
      write: false,
      platform: "node",
      format: "esm",
      logLevel: "silent",
      plugins: [
        createEsbuildScanPlugin({
          clientFiles,
          serverFiles,
          aliases: ensureAliasArray(env),
        }),
      ],
    });
  } catch (e: any) {
    throw new Error(`RWSDK directive scan failed:\n${e.message}`);
  }

  log(
    "Finished esbuild scan for environment '%s'. Found %d client files and %d server files.",
    envName,
    clientFiles.size,
    serverFiles.size,
  );
}
