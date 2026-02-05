// @ts-ignore
import { compile } from "@mdx-js/mdx";
import debug from "debug";
// @ts-ignore
import { OnLoadArgs, OnResolveArgs, Plugin, PluginBuild } from "esbuild";
import { glob } from "glob";
import fsp from "node:fs/promises";
import path from "node:path";
import { Environment, ResolvedConfig } from "vite";
import { INTERMEDIATES_OUTPUT_DIR } from "../lib/constants.mjs";
import { normalizeModulePath } from "../lib/normalizeModulePath.mjs";
import { externalModules } from "./constants.mjs";
import { createViteAwareResolver } from "./createViteAwareResolver.mjs";
import { getViteEsbuild } from "./getViteEsbuild.mjs";
import { hasDirective } from "./hasDirective.mjs";

const log = debug("rwsdk:vite:run-directives-scan");

// Copied from Vite's source code.
// https://github.com/vitejs/vite/blob/main/packages/vite/src/shared/utils.ts
const isObject = (value: unknown): value is Record<string, any> =>
  Object.prototype.toString.call(value) === "[object Object]";

// Copied from Vite's source code.
// https://github.com/vitejs/vite/blob/main/packages/vite/src/node/utils.ts
const externalRE = /^(https?:)?\/\//;
const isExternalUrl = (url: string): boolean => externalRE.test(url);

type ReadFileWithCache = (path: string) => Promise<string>;

export const DEFAULT_DIRECTIVE_SCAN_BLOCKLIST = ["lucide-react"];

export const normalizeBlocklist = (blocklist?: string[]) => {
  return (blocklist ?? [])
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
};

export const isBlockedSpecifier = (specifier: string, blocklist: string[]) => {
  return blocklist.some(
    (entry) => specifier === entry || specifier.startsWith(`${entry}/`),
  );
};

export const isBlockedResolvedPath = (
  resolvedPath: string,
  blocklist: string[],
) => {
  const normalizedPath = resolvedPath.replace(/\\/g, "/");
  return blocklist.some((entry) =>
    normalizedPath.includes(`/node_modules/${entry}/`),
  );
};

async function findDirectiveRoots({
  root,
  readFileWithCache,
  directiveCheckCache,
}: {
  root: string;
  readFileWithCache: ReadFileWithCache;
  directiveCheckCache: Map<string, boolean>;
}): Promise<Set<string>> {
  const srcDir = path.resolve(root, "src");
  const files = await glob("**/*.{ts,tsx,js,jsx,mjs,mts,cjs,cts,mdx}", {
    cwd: srcDir,
    absolute: true,
  });

  const directiveFiles = new Set<string>();
  for (const file of files) {
    if (directiveCheckCache.has(file)) {
      if (directiveCheckCache.get(file)) {
        directiveFiles.add(file);
      }
      continue;
    }

    try {
      const content = await readFileWithCache(file);
      const hasClient = hasDirective(content, "use client");
      const hasServer = hasDirective(content, "use server");
      const hasAnyDirective = hasClient || hasServer;

      directiveCheckCache.set(file, hasAnyDirective);
      if (hasAnyDirective) {
        directiveFiles.add(file);
      }
    } catch (e) {
      log("Could not read file during pre-scan, skipping:", file);
      // Cache the failure to avoid re-reading a problematic file
      directiveCheckCache.set(file, false);
    }
  }

  log("Pre-scan found directive files:", Array.from(directiveFiles));
  return directiveFiles;
}

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
  directiveScanBlocklist,
}: {
  rootConfig: ResolvedConfig;
  environments: Record<string, Environment>;
  clientFiles: Set<string>;
  serverFiles: Set<string>;
  entries?: string[];
  directiveScanBlocklist?: string[];
}) => {
  deferredLog(
    "\n… (rwsdk) Scanning for 'use client' and 'use server' directives...",
  );

  try {
    const combinedBlocklist = [
      ...DEFAULT_DIRECTIVE_SCAN_BLOCKLIST,
      ...normalizeBlocklist(directiveScanBlocklist),
    ];
    const fileContentCache = new Map<string, string>();
    const directiveCheckCache = new Map<string, boolean>();
    const readFileWithCache = async (path: string) => {
      if (fileContentCache.has(path)) {
        return fileContentCache.get(path)!;
      }
      const contents = await fsp.readFile(path, "utf-8");
      fileContentCache.set(path, contents);
      return contents;
    };
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

    const applicationDirectiveFiles = await findDirectiveRoots({
      root: rootConfig.root,
      readFileWithCache,
      directiveCheckCache,
    });

    const combinedEntries = new Set([
      ...absoluteEntries,
      ...applicationDirectiveFiles,
    ]);

    log(
      "Starting directives scan with combined entries:",
      Array.from(combinedEntries),
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
          if (isBlockedSpecifier(args.path, combinedBlocklist)) {
            log("Skipping directive scan for blocked package:", args.path);
            return { external: true };
          }

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
            try {
              const stats = await fsp.stat(resolvedPath);
              if (stats.isDirectory()) {
                log(
                  "Resolved path is a directory, marking as external to avoid scan error:",
                  resolvedPath,
                );
                return { external: true };
              }
            } catch (e) {
              // This can happen for virtual modules or special paths that don't
              // exist on the filesystem. We can safely externalize them.
              log(
                "Could not stat resolved path, marking as external:",
                resolvedPath,
              );
              return { external: true };
            }

            if (isBlockedResolvedPath(resolvedPath, combinedBlocklist)) {
              log(
                "Skipping directive scan for blocked path:",
                resolvedPath,
              );
              return { external: true };
            }
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
              !path.isAbsolute(args.path) ||
              args.path.includes("virtual:") ||
              isExternalUrl(args.path)
            ) {
              log("Skipping file due to filter:", args.path, {
                isAbsolute: path.isAbsolute(args.path),
                hasVirtual: args.path.includes("virtual:"),
                isExternal: isExternalUrl(args.path),
              });
              return null;
            }

            try {
              if (isBlockedResolvedPath(args.path, combinedBlocklist)) {
                log("Skipping directive scan for blocked path:", args.path);
                return null;
              }

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
      entryPoints: Array.from(combinedEntries),
      bundle: true,
      write: false,
      outdir: path.join(INTERMEDIATES_OUTPUT_DIR, "directive-scan"),
      platform: "node",
      format: "esm",
      logLevel: "silent",
      plugins: [esbuildScanPlugin],
    });
  } catch (e: any) {
    throw new Error(
      `RedwoodSDK: Directive scan failed. This often happens due to syntax errors in files using "use client" or "use server". Check your directive files for issues.\n\n` +
        `For detailed troubleshooting steps, see: https://docs.rwsdk.com/guides/troubleshooting#directive-scan-errors\n\n` +
        `${e.stack}`,
    );
  } finally {
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
  const doLog = process.env.RWSDK_WORKER_RUN ? log : console.log;

  setTimeout(() => {
    doLog(message);
  }, 500);
};
