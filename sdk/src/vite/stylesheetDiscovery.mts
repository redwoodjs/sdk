import type { Manifest, ModuleNode, ViteDevServer } from "vite";
import { extname, join } from "node:path";
import { readFile } from "node:fs/promises";
import { pathExists } from "fs-extra";
import debug from "debug";

const log = debug("rwsdk:vite:stylesheet-discovery");

const CSS_LANGS = [
  ".css",
  ".less",
  ".sass",
  ".scss",
  ".styl",
  ".stylus",
  ".pcss",
  ".postcss",
];

async function getViteManifest(
  projectRootDir: string,
): Promise<Manifest | undefined> {
  const manifestPath = join(
    projectRootDir,
    "dist",
    "client",
    ".vite",
    "manifest.json",
  );

  if (!(await pathExists(manifestPath))) {
    log("Vite manifest not found at %s", manifestPath);
    return undefined;
  }

  try {
    log("Reading Vite manifest from %s", manifestPath);
    return JSON.parse(await readFile(manifestPath, "utf-8"));
  } catch (e) {
    console.error(`Could not load Vite manifest at ${manifestPath}`, e);
    return undefined;
  }
}

function getCssFromModuleGraph(
  moduleId: string,
  viteDevServer: ViteDevServer,
): Set<string> {
  const css = new Set<string>();
  const seen = new Set<ModuleNode>();

  const moduleNode = viteDevServer.moduleGraph.getModuleById(moduleId);

  if (moduleNode) {
    const queue = [moduleNode];
    seen.add(moduleNode);

    while (queue.length > 0) {
      const mod = queue.shift()!;

      if (mod.file && CSS_LANGS.includes(extname(mod.file))) {
        css.add(mod.url);
      }

      for (const imported of mod.importedModules) {
        if (!seen.has(imported)) {
          seen.add(imported);
          queue.push(imported);
        }
      }
    }
  }

  return css;
}

function getCssFromManifest(moduleId: string, manifest: Manifest): Set<string> {
  const css = new Set<string>();
  const seen = new Set<string>();

  const queue = [moduleId];
  seen.add(moduleId);

  while (queue.length > 0) {
    const id = queue.shift()!;
    const chunk = manifest[id];

    if (chunk) {
      if (chunk.css) {
        for (const href of chunk.css) {
          css.add(href);
        }
      }

      if (chunk.imports) {
        for (const importId of chunk.imports) {
          if (!seen.has(importId)) {
            seen.add(importId);
            queue.push(importId);
          }
        }
      }
    }
  }

  return css;
}

export async function findStylesheetsInGraph(
  moduleId: string,
  projectRootDir: string,
  viteDevServer?: ViteDevServer,
): Promise<Set<string>> {
  if (viteDevServer) {
    await viteDevServer.environments.client.transformRequest(moduleId);
    return getCssFromModuleGraph(moduleId, viteDevServer);
  } else {
    const manifest = await getViteManifest(projectRootDir);

    if (!manifest) {
      return new Set();
    }

    return getCssFromManifest(moduleId, manifest);
  }
}
