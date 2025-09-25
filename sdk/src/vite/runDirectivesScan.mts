// @ts-ignore
import { OnLoadArgs, OnResolveArgs, Plugin, PluginBuild } from "esbuild";
import { Environment, ResolvedConfig } from "vite";
import fsp from "node:fs/promises";
import { hasDirective } from "./hasDirective.mjs";
import path from "node:path";
import debug from "debug";
import { getViteEsbuild } from "./getViteEsbuild.mjs";
import { normalizeModulePath } from "../lib/normalizeModulePath.mjs";
import { INTERMEDIATES_OUTPUT_DIR } from "../lib/constants.mjs";
import { externalModules } from "./constants.mjs";
import { createViteAwareResolver } from "./createViteAwareResolver.mjs";
import { compile } from "@mdx-js/mdx";

const log = debug("rwsdk:vite:run-directives-scan");

// Copied from Vite's source code.
// https://github.com/vitejs/vite/blob/main/packages/vite/src/shared/utils.ts
const isObject = (value: unknown): value is Record<string, any> =>
  Object.prototype.toString.call(value) === "[object Object]";

// Copied from Vite's source code.
// https://github.com/vitejs/vite/blob/main/packages/vite/src/node/utils.ts
const externalRE = /^(https?:)?\/\//;
const isExternalUrl = (url: string): boolean => externalRE.test(url);

type Resolver = (
  context: {},
  path: string,
  request: string,
  resolveContext: {},
  callback: (err: Error | null, result?: string | false) => void,
) => void;

export async function resolveModuleWithEnvironment({
  path,
  importer,
  importerEnv,
  clientResolver,
  workerResolver,
}: {
  path: string;
  importer?: string;
  importerEnv: "client" | "worker";
  clientResolver: Resolver;
  workerResolver: Resolver;
}) {
  const resolver = importerEnv === "client" ? clientResolver : workerResolver;
  return new Promise<{ id: string } | null>((resolvePromise) => {
    resolver({}, importer || "", path, {}, (err, result) => {
      if (!err && result) {
        resolvePromise({ id: result });
      } else {
        if (err) {
          const errorMessage = err.message || String(err);
          if (errorMessage.includes("Package path . is not exported")) {
            log("Package exports error for %s, marking as external", path);
          } else {
            log("Resolution failed for %s: %s", path, errorMessage);
          }
        }
        resolvePromise(null);
      }
    });
  });
}

export function classifyModule({
  contents,
  inheritedEnv,
}: {
  contents: string;
  inheritedEnv: "client" | "worker";
}) {
  let moduleEnv: "client" | "worker" = inheritedEnv;
  const isClient = hasDirective(contents, "use client");
  const isServer = hasDirective(contents, "use server");

  if (isClient) {
    moduleEnv = "client";
  } else if (isServer) {
    moduleEnv = "worker";
  }

  return { moduleEnv, isClient, isServer };
}

export type EsbuildLoader = "js" | "jsx" | "ts" | "tsx" | "default";

export const runDirectivesScan = async ({
  rootConfig,
  environments,
  clientFiles,
  serverFiles,
  entries: initialEntries,
}: {
  rootConfig: ResolvedConfig;
  environments: Record<string, Environment>;
  clientFiles: Set<string>;
  serverFiles: Set<string>;
  entries?: string[];
}) => {
  deferredLog(
    "\n… (rwsdk) Scanning for 'use client' and 'use server' directives...",
  );

  // Set environment variable to indicate scanning is in progress
  process.env.RWSDK_DIRECTIVE_SCAN_ACTIVE = "true";

  try {
    const esbuild = await getViteEsbuild(rootConfig.root);
    const input =
      initialEntries ?? environments.worker.config.build.rollupOptions?.input;
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
        "No entries found for directives scan in worker environment, skipping.",
      );
      return;
    }

    // Filter out virtual modules since they can't be scanned by esbuild
    const realEntries = entries.filter((entry) => !entry.includes("virtual:"));

    const absoluteEntries = realEntries.map((entry) =>
      path.resolve(rootConfig.root, entry),
    );

    log(
      "Starting directives scan for worker environment with entries:",
      absoluteEntries,
    );

    const workerResolver = createViteAwareResolver(
      rootConfig,
      environments.worker,
    );

    const clientResolver = createViteAwareResolver(
      rootConfig,
      environments.client,
    );

    const moduleEnvironments = new Map<string, "client" | "worker">();
    const fileContentCache = new Map<string, string>();

    const readFileWithCache = async (path: string) => {
      if (fileContentCache.has(path)) {
        return fileContentCache.get(path)!;
      }
      const contents = await fsp.readFile(path, "utf-8");
      fileContentCache.set(path, contents);
      return contents;
    };

    const esbuildScanPlugin: Plugin = {
      name: "rwsdk:esbuild-scan-plugin",
      setup(build: PluginBuild) {
        // Match Vite's behavior by externalizing assets and special queries.
        // This prevents esbuild from trying to bundle them, which would fail.
        const scriptFilter = /\.(c|m)?[jt]sx?$|\.mdx$/;
        const specialQueryFilter =
          /[?&](?:url|raw|worker|sharedworker|inline)\b/;
        // This regex is used to identify if a path has any file extension.
        const hasExtensionRegex = /\.[^/]+$/;

        build.onResolve(
          { filter: specialQueryFilter },
          (args: OnResolveArgs) => {
            log("Externalizing special query:", args.path);
            return { external: true };
          },
        );

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
          if (externalModules.includes(args.path)) {
            return { external: true };
          }

          log("onResolve called for:", args.path, "from:", args.importer);

          let importerEnv = moduleEnvironments.get(args.importer);

          // If we don't know the importer's environment yet, check its content
          if (
            !importerEnv &&
            args.importer &&
            /\.(m|c)?[jt]sx?$/.test(args.importer)
          ) {
            try {
              const importerContents = await readFileWithCache(args.importer);
              const classification = classifyModule({
                contents: importerContents,
                inheritedEnv: "worker", // Default for entry points
              });
              importerEnv = classification.moduleEnv;
              log(
                "Pre-detected importer environment in:",
                args.importer,
                "as",
                importerEnv,
              );
              moduleEnvironments.set(args.importer, importerEnv);
            } catch (e) {
              importerEnv = "worker"; // Default fallback
              log(
                "Could not pre-read importer, using worker environment:",
                args.importer,
              );
            }
          } else if (!importerEnv) {
            importerEnv = "worker"; // Default for entry points or non-script files
          }

          log("Importer:", args.importer, "environment:", importerEnv);

          const resolved = await resolveModuleWithEnvironment({
            path: args.path,
            importer: args.importer,
            importerEnv,
            clientResolver,
            workerResolver,
          });

          log("Resolution result:", resolved);
          const resolvedPath = resolved?.id;

          if (resolvedPath && path.isAbsolute(resolvedPath)) {
            // Normalize the path for esbuild compatibility
            const normalizedPath = normalizeModulePath(
              resolvedPath,
              rootConfig.root,
              { absolute: true },
            );
            log("Normalized path:", normalizedPath);

            return {
              path: normalizedPath,
              pluginData: { inheritedEnv: importerEnv },
            };
          }

          log("Marking as external:", args.path, "resolved to:", resolvedPath);
          return { external: true };
        });

        build.onLoad(
          { filter: /\.(m|c)?[jt]sx?$|\.mdx$/ },
          async (args: OnLoadArgs) => {
            log("onLoad called for:", args.path);

            if (
              !args.path.startsWith("/") ||
              args.path.includes("virtual:") ||
              isExternalUrl(args.path)
            ) {
              log("Skipping file due to filter:", args.path, {
                startsWithSlash: args.path.startsWith("/"),
                hasVirtual: args.path.includes("virtual:"),
                isExternal: isExternalUrl(args.path),
              });
              return null;
            }

            try {
              const originalContents = await readFileWithCache(args.path);
              const inheritedEnv = args.pluginData?.inheritedEnv || "worker";

              const { moduleEnv, isClient, isServer } = classifyModule({
                contents: originalContents,
                inheritedEnv,
              });

              // Store the definitive environment for this module, so it can be used when it becomes an importer.
              const realPath = await fsp.realpath(args.path);
              moduleEnvironments.set(realPath, moduleEnv);
              log("Set environment for", realPath, "to", moduleEnv);

              // Finally, populate the output sets if the file has a directive.
              if (isClient) {
                log("Discovered 'use client' in:", realPath);
                clientFiles.add(normalizeModulePath(realPath, rootConfig.root));
              }
              if (isServer) {
                log("Discovered 'use server' in:", realPath);
                serverFiles.add(normalizeModulePath(realPath, rootConfig.root));
              }

              let code: string;
              let loader: EsbuildLoader;

              if (args.path.endsWith(".mdx")) {
                const result = await compile(originalContents, {
                  jsx: true,
                  jsxImportSource: "react",
                });
                code = String(result.value);
                loader = "tsx";
              } else if (/\.(m|c)?tsx$/.test(args.path)) {
                code = originalContents;
                loader = "tsx";
              } else if (/\.(m|c)?ts$/.test(args.path)) {
                code = originalContents;
                loader = "ts";
              } else if (/\.(m|c)?jsx$/.test(args.path)) {
                code = originalContents;
                loader = "jsx";
              } else {
                code = originalContents;
                loader = "js";
              }

              return { contents: code, loader };
            } catch (e) {
              log("Could not read file during scan, skipping:", args.path, e);
              return null;
            }
          },
        );
      },
    };

    await esbuild.build({
      entryPoints: absoluteEntries,
      bundle: true,
      write: false,
      outdir: path.join(INTERMEDIATES_OUTPUT_DIR, "directive-scan"),
      platform: "node",
      format: "esm",
      logLevel: "silent",
      plugins: [esbuildScanPlugin],
    });
  } catch (e: any) {
    throw new Error(`RWSDK directive scan failed:\n${e.stack}`);
  } finally {
    // Always clear the scanning flag when done
    delete process.env.RWSDK_DIRECTIVE_SCAN_ACTIVE;
    deferredLog(
      "✔ (rwsdk) Done scanning for 'use client' and 'use server' directives.",
    );
    process.env.VERBOSE &&
      log(
        "Client/server files after scanning: client=%O, server=%O",
        Array.from(clientFiles),
        Array.from(serverFiles),
      );
  }
};

const deferredLog = (message: string) => {
  setTimeout(() => {
    console.log(message);
  }, 500);
};
