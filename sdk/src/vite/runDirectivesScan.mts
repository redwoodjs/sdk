import type { Alias, ResolvedConfig } from "vite";
import path from "node:path";
import { builtinModules } from "node:module";
import debug from "debug";
import { readFile } from "node:fs/promises";
import type * as esbuild from "esbuild";

import { hasDirective } from "./hasDirective.mjs";
import { isJsFile } from "./isJsFile.mjs";
import { ensureAliasArray } from "./ensureAliasArray.mjs";
import { getViteEsbuild } from "./getViteEsbuild.mjs";
import { normalizeModulePath } from "../lib/normalizeModulePath.mjs";
import { externalModules } from "./configPlugin.mjs";

const log = debug("rwsdk:vite:run-directives-scan");

// Copied from Vite's source code.
// https://github.com/vitejs/vite/blob/ca53232233b24c1ed9a715392d77d73e03ab5a58/packages/vite/src/node/plugins/esbuild.ts#L225-L230
const externalRE = /^(https?|data|node):/;
const isExternalUrl = (url: string): boolean => externalRE.test(url);

function createEsbuildScanPlugin(
  rootConfig: ResolvedConfig,
  clientFiles: Set<string>,
  serverFiles: Set<string>,
): {
  plugin: esbuild.Plugin;
  // A promise that resolves when the first non-virtual module is resolved,
  // which signals that the scan is complete
  scanComplete: Promise<void>;
} {
  let resolveScanComplete: () => void;
  const scanComplete = new Promise<void>((res) => {
    resolveScanComplete = res;
  });

  const plugin: esbuild.Plugin = {
    name: "rwsdk:esbuild-scan-plugin",
    setup(build) {
      // For some reason, the esbuild resolver doesn't seem to be respecting
      // the `mainFields` or `resolveExtensions` config options.
      // So we have to do it ourselves.
      build.onResolve({ filter: /.*/ }, async (args) => {
        if (isExternalUrl(args.path)) {
          return {
            path: args.path,
            external: true,
          };
        }

        if (args.path.startsWith("virtual:")) {
          return;
        }

        // We use Vite's resolver to resolve the path. This ensures that we
        // respect all of Vite's config (e.g. aliases, resolve.conditions, etc.)
        const resolved = await rootConfig.createResolver()(
          args.path,
          args.importer,
        );

        if (resolved) {
          if (
            !resolved.includes("node_modules") &&
            !path.isAbsolute(resolved)
          ) {
            return {
              path: path.resolve(rootConfig.root, resolved),
            };
          } else {
            return {
              path: resolved,
            };
          }
        }
      });

      build.onLoad({ filter: /.*/ }, async (args) => {
        if (isJsFile(args.path)) {
          const contents = await readFile(args.path, "utf-8");

          if (hasDirective(contents, "use client")) {
            const normalizedPath = normalizeModulePath(
              args.path,
              rootConfig.root,
            );
            log("Found 'use client' in %s", normalizedPath);
            clientFiles.add(normalizedPath);
          } else if (hasDirective(contents, "use server")) {
            const normalizedPath = normalizeModulePath(
              args.path,
              rootConfig.root,
            );
            log("Found 'use server' in %s", normalizedPath);
            serverFiles.add(normalizedPath);
          }

          return {
            contents,
            loader: "tsx",
          };
        }
      });
    },
  };

  return {
    plugin,
    scanComplete,
  };
}

export async function runDirectivesScan({
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
  const esbuild = await getViteEsbuild();
  const env = rootConfig.environments[envName];

  if (!env) {
    throw new Error(`Environment ${envName} not found in Vite config`);
  }

  const { plugin } = createEsbuildScanPlugin(
    rootConfig,
    clientFiles,
    serverFiles,
  );

  const aliases = ensureAliasArray(rootConfig.resolve.alias || []);
  const entryPoints =
    typeof env.config.build?.rollupOptions?.input === "string"
      ? [env.config.build.rollupOptions.input]
      : Array.isArray(env.config.build?.rollupOptions?.input)
        ? env.config.build.rollupOptions.input
        : Object.values(env.config.build?.rollupOptions?.input || {});

  try {
    await esbuild.build({
      entryPoints,
      bundle: true,
      write: false,
      logLevel: "silent",
      format: "esm",
      mainFields: ["module", "main"],
      resolveExtensions: [".tsx", ".ts", ".jsx", ".js", ".mjs", ".cjs"],
      plugins: [
        {
          name: "rwsdk:externalize-deps",
          setup(build) {
            build.onResolve({ filter: /.*/ }, async (args) => {
              if (
                externalModules.some((ext) => args.path.startsWith(ext)) ||
                args.path.includes("node_modules")
              ) {
                return {
                  path: args.path,
                  external: true,
                };
              }

              const resolved = await build.resolve(args.path, {
                importer: args.importer,
                kind: args.kind,
                resolveDir: path.dirname(args.importer),
              });

              if (resolved.external) {
                return {
                  path: args.path,
                  external: true,
                };
              }
            });
          },
        },
        plugin,
      ],
      alias: aliases.reduce(
        (acc, alias) => {
          acc[alias.find.toString()] = alias.replacement;
          return acc;
        },
        {} as Record<string, string>,
      ),
    });
  } catch (e) {
    console.error("Esbuild scan failed");
    console.error(e);
  }
}
