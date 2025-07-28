import type { Plugin } from "vite";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { findStylesheetsInGraph } from "./stylesheetDiscovery.mjs";

const VIRTUAL_MODULE_ID = "virtual:stylesheet-lookup";
const RESOLVED_VIRTUAL_MODULE_ID = "\0" + VIRTUAL_MODULE_ID;
const VIRTUAL_STYLESHEET_ENDPOINT = "/__rws_stylesheets";

function getCssFromManifest(
  moduleId: string,
  manifest: Record<string, any>,
): Set<string> {
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

export function virtualStylesheetPlugin(): Plugin {
  let manifest: Record<string, any> | undefined;

  return {
    name: "rwsdk:virtual-stylesheet",

    resolveId(id) {
      if (id === VIRTUAL_MODULE_ID) {
        return RESOLVED_VIRTUAL_MODULE_ID;
      }
    },

    async load(id) {
      if (id === RESOLVED_VIRTUAL_MODULE_ID) {
        if (this.environment.name !== "worker") {
          return "";
        }

        if (this.environment.config.command === "serve") {
          return `
            export async function findStylesheetsForEntryPoint(moduleId) {
              const res = await fetch('/__rws_stylesheets?id=' + moduleId);
              if (!res.ok) {
                console.error('Failed to fetch stylesheets for', moduleId);
                return new Set();
              }
              const stylesheets = await res.json();
              return new Set(stylesheets);
            }
          `;
        } else {
          // Production build
          if (!manifest) {
            const manifestPath = join(
              this.environment.config.root,
              this.environment.config.build.outDir,
              ".vite",
              "manifest.json",
            );
            try {
              manifest = JSON.parse(await readFile(manifestPath, "utf-8"));
            } catch (e) {
              this.warn(`Could not load manifest at ${manifestPath}`);
              manifest = {};
            }
          }
          return `
            const manifest = ${JSON.stringify(manifest)};
            const getCssFromManifest = ${getCssFromManifest.toString()};

            export function findStylesheetsForEntryPoint(moduleId) {
              return getCssFromManifest(moduleId, manifest);
            }
          `;
        }
      }
    },

    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url?.startsWith(VIRTUAL_STYLESHEET_ENDPOINT)) {
          const url = new URL(req.url, `http://${req.headers.host}`);
          const moduleId = url.searchParams.get("id");

          if (!moduleId) {
            res.statusCode = 400;
            res.end("Missing module ID");
            return;
          }

          try {
            const stylesheets = await findStylesheetsInGraph(
              moduleId,
              server.config.root,
              server,
            );
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify([...stylesheets]));
          } catch (error) {
            console.error(`Error finding stylesheets for ${moduleId}:`, error);
            res.statusCode = 500;
            res.end("Error finding stylesheets");
          }
        } else {
          next();
        }
      });
    },
  };
}
