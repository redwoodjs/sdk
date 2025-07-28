import * as path from "node:path";
import * as fs from "node:fs/promises";
import debug from "debug";

import type { ViteDevServer, EnvironmentModuleNode } from "vite";
import { normalizeModulePath } from "../lib/normalizeModulePath.mjs";

const log = debug("rwsdk:vite:stylesheet-discovery");

const isStylesheet = (file: string) =>
  /\.(css|scss|sass|less|styl|stylus)($|\?)/.test(file);

async function findStylesheetsInDev(
  entryPointUrl: string,
  server: ViteDevServer,
): Promise<string[]> {
  const styles = new Set<string>();

  // Ensure the module and its dependencies are in the graph.
  // This is the key change for handling dynamically discovered components.
  await server.environments.client.transformRequest(entryPointUrl);

  const entryModule =
    await server.environments.client.moduleGraph.getModuleByUrl(entryPointUrl);

  if (!entryModule) {
    log(`Could not find module for entry point: ${entryPointUrl}`);
    return [];
  }

  const queue: EnvironmentModuleNode[] = [entryModule];
  const visited = new Set<string>([entryModule.id!]);

  while (queue.length > 0) {
    const mod = queue.shift()!;

    if (mod.file && isStylesheet(mod.file) && mod.url) {
      styles.add(mod.url);
    }

    mod.importedModules.forEach((imported) => {
      // The `imported` module can be a ModuleNode or an EnvironmentModuleNode
      const importedModule =
        server.environments.client.moduleGraph.getModuleById(imported.id!);

      if (
        importedModule &&
        importedModule.id &&
        !visited.has(importedModule.id)
      ) {
        visited.add(importedModule.id);
        queue.push(importedModule);
      }
    });
  }

  return Array.from(styles);
}

async function findStylesheetsInProd(
  entryPoint: string,
  projectRootDir: string,
  buildOutDir: string,
): Promise<string[]> {
  // The entry point in the manifest is relative to the project root
  const manifestEntry = path.relative(projectRootDir, entryPoint);

  const manifestPath = path.join(
    projectRootDir,
    buildOutDir,
    "client/.vite/manifest.json",
  );

  try {
    const manifest = JSON.parse(await fs.readFile(manifestPath, "utf-8"));
    const entry = manifest[manifestEntry];
    return entry?.css?.map((p: string) => `/${p}`) ?? [];
  } catch (e) {
    console.error(
      `RedwoodSDK: Could not read client manifest at ${manifestPath}.`,
      e,
    );
    return [];
  }
}

export async function findStylesheetsForEntryPoint(
  entryPoint: string,
  projectRootDir: string,
  viteDevServer?: ViteDevServer,
): Promise<string[]> {
  const entryPointUrl = normalizeModulePath(entryPoint, projectRootDir, {
    isViteStyle: true,
  });

  if (viteDevServer) {
    process.env.VERBOSE &&
      log("Finding stylesheets in dev for entry point: %s", entryPointUrl);
    return findStylesheetsInDev(entryPointUrl, viteDevServer);
  }

  const buildOutDir = process.env.RWJS_CWD
    ? path.relative(projectRootDir, process.env.RWJS_CWD)
    : "dist";

  process.env.VERBOSE &&
    log("Finding stylesheets in build for entry point: %s", entryPoint);
  return findStylesheetsInProd(entryPoint, projectRootDir, buildOutDir);
}
