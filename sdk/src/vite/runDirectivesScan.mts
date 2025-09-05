// @ts-ignore
import { OnLoadArgs, OnResolveArgs, Plugin, PluginBuild } from "esbuild";
import { Environment, ResolvedConfig } from "vite";
import fsp from "node:fs/promises";
import { hasDirective } from "./hasDirective.mjs";
import path from "node:path";
import debug from "debug";
import { getViteEsbuild } from "./getViteEsbuild.mjs";
import { normalizeModulePath } from "../lib/normalizeModulePath.mjs";
import { externalModules } from "./constants.mjs";
import { createViteAwareResolver } from "./createViteAwareResolver.mjs";

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
  console.log("\n🔍 Scanning for 'use client' and 'use server' directives...");

  // Set environment variable to indicate scanning is in progress
  process.env.RWSDK_DIRECTIVE_SCAN_ACTIVE = "true";

  try {
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

    // Use enhanced-resolve with Vite plugin integration for full compatibility
    const workerResolver = createViteAwareResolver(
      rootConfig,
      environment.name,
      environment,
    );

    const clientResolver = createViteAwareResolver(
      rootConfig,
      "client",
      environment,
    );

    const moduleEnvironments = new Map<string, "client" | "worker">();

    const esbuildScanPlugin: Plugin = {
      name: "rwsdk:esbuild-scan-plugin",
      setup(build: PluginBuild) {
        // Match Vite's behavior by externalizing assets and special queries.
        // This prevents esbuild from trying to bundle them, which would fail.
        const scriptFilter = /\.(c|m)?[jt]sx?$/;
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

          const importerEnv = moduleEnvironments.get(args.importer) || "worker";
          log("Importer:", args.importer, "environment:", importerEnv);

          const resolver =
            importerEnv === "client" ? clientResolver : workerResolver;

          const resolved = await new Promise<{ id: string } | null>(
            (resolve) => {
              resolver(
                {},
                args.importer || rootConfig.root,
                args.path,
                {},
                (err, result) => {
                  if (!err && result) {
                    resolve({ id: result });
                  } else {
                    if (err) {
                      const errorMessage = err.message || String(err);
                      if (
                        errorMessage.includes("Package path . is not exported")
                      ) {
                        log(
                          "Package exports error for %s, marking as external",
                          args.path,
                        );
                      } else {
                        log(
                          "Resolution failed for %s: %s",
                          args.path,
                          errorMessage,
                        );
                      }
                    }
                    resolve(null);
                  }
                },
              );
            },
          );

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
          { filter: /\.(m|c)?[jt]sx?$/ },
          async (args: OnLoadArgs) => {
            log("onLoad called for:", args.path);
            const inheritedEnv = args.pluginData?.inheritedEnv || "worker";
            log("Inherited environment for", args.path, "is", inheritedEnv);

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
              const contents = await fsp.readFile(args.path, "utf-8");
              let currentEnv: "client" | "worker" = inheritedEnv;

              if (hasDirective(contents, "use client")) {
                log("Discovered 'use client' in:", args.path);
                clientFiles.add(
                  normalizeModulePath(args.path, rootConfig.root),
                );
                currentEnv = "client";
              }
              if (hasDirective(contents, "use server")) {
                log("Discovered 'use server' in:", args.path);
                serverFiles.add(
                  normalizeModulePath(args.path, rootConfig.root),
                );
                currentEnv = "worker";
              }

              moduleEnvironments.set(args.path, currentEnv);
              log("Set environment for", args.path, "to", currentEnv);

              return { contents, loader: "default" };
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
    console.log("✅ Scan complete.");
  }
};
