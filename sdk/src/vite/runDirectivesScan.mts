import { BuildOptions, ResolvedConfig } from "vite";
import fsp from "node:fs/promises";
import { hasDirective } from "./hasDirective.mjs";
import path from "node:path";
import debug from "debug";
import { getViteEsbuild } from "./getViteEsbuild.mjs";
import { normalizeModulePath } from "../lib/normalizeModulePath.mjs";
import { createViteAwareResolver } from "./createViteAwareResolver.mjs";
import { ResolveFunctionAsync } from "enhanced-resolve";
import { EXTERNAL_MODULES } from "./constants.mjs";

const log = debug("rwsdk:vite:run-directives-scan");

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
  projectRootDir,
  resolver,
}: {
  clientFiles: Set<string>;
  serverFiles: Set<string>;
  projectRootDir: string;
  resolver: ResolveFunctionAsync;
}) {
  return {
    name: "rwsdk:esbuild-scan-plugin",
    setup(build: any) {
      // Match Vite's behavior by externalizing assets and special queries.
      const scriptFilter = /\.(c|m)?[jt]sx?$/;
      const specialQueryFilter = /[?&](?:url|raw|worker|sharedworker|inline)\b/;
      const hasExtensionRegex = /\.[^/]+$/;

      build.onResolve({ filter: specialQueryFilter }, (args: any) => {
        log("Externalizing special query:", args.path);
        return { external: true };
      });

      build.onResolve({ filter: /.*/, namespace: "file" }, (args: any) => {
        if (
          hasExtensionRegex.test(args.path) &&
          !scriptFilter.test(args.path)
        ) {
          log("Externalizing non-script import:", args.path);
          return { external: true };
        }
      });

      build.onResolve({ filter: /.*/ }, async (args: any) => {
        if (EXTERNAL_MODULES.includes(args.path)) {
          return { external: true };
        }

        try {
          const resolvedPath = await new Promise<string | false>(
            (resolve, reject) => {
              resolver(
                {},
                args.importer ? path.dirname(args.importer) : projectRootDir,
                args.path,
                {},
                (err, result) => {
                  if (err) {
                    return reject(err);
                  }
                  resolve(result || false);
                },
              );
            },
          );

          if (resolvedPath) {
            return {
              path: resolvedPath,
            };
          } else {
            log(
              "Resolver returned no path for '%s' from '%s', marking as external.",
              args.path,
              args.importer,
            );
            return { external: true };
          }
        } catch (e) {
          console.log("######", { input: args.path, output: e });
          process.exit(1);
          log(
            "Resolver failed for '%s' from '%s', marking as external. Error: %s",
            args.path,
            args.importer,
            e,
          );
          return { external: true };
        }
      });

      build.onLoad({ filter: /\.(m|c)?[jt]sx?$/ }, async (args: any) => {
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
            clientFiles.add(normalizeModulePath(args.path, projectRootDir));
          }
          if (hasDirective(contents, "use server")) {
            log("Discovered 'use server' in:", args.path);
            serverFiles.add(normalizeModulePath(args.path, projectRootDir));
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
  const esbuild = await getViteEsbuild(rootConfig.root);
  const input = rootConfig.environments[envName].build.rollupOptions?.input;
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
      envName,
    );
    return;
  }

  const absoluteEntries = entries.map((entry) =>
    path.resolve(rootConfig.root, entry),
  );

  log(
    "Starting directives scan for environment '%s' with entries:",
    envName,
    absoluteEntries,
  );

  const resolver = createViteAwareResolver(rootConfig, envName);

  try {
    const result = await esbuild.build({
      entryPoints: absoluteEntries,
      bundle: true,
      write: false,
      platform: "node",
      format: "esm",
      logLevel: "silent",
      metafile: true,
      plugins: [
        createEsbuildScanPlugin({
          clientFiles,
          serverFiles,
          projectRootDir: rootConfig.root,
          resolver,
        }),
      ],
    });

    return result.metafile;
  } catch (e: any) {
    throw new Error(`RWSDK directive scan failed:\n${e.message}`);
  }
}
