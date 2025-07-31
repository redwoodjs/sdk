import { type Plugin } from "vite";
import path from "node:path";
import fs from "node:fs/promises";

interface RscCssMapPluginOptions {
  /**
   * The path to the manifest file to be generated.
   * This file will contain a mapping of RSC CSS module IDs to their output CSS files.
   * @example 'dist/worker/rsc-css-map.json'
   */
  rscCssMapPath: string;
}

export function rscCssMapPlugin(options: RscCssMapPluginOptions): Plugin {
  const { rscCssMapPath } = options;
  const rscCssMap: Record<string, string> = {};

  const cssMap = new Map<string, string>();
  return {
    name: "rwsdk:rsc-css-map",
    apply: "build",
    enforce: "post",

    transform(code, id) {
      if (this.environment.name !== "worker") {
        return;
      }

      if (id.endsWith(".module.css")) {
        cssMap.set(id, code);
      }
      return null;
    },

    async generateBundle(outputOptions, bundle) {
      console.log("############################33", this.environment.name);
      if (this.environment.name !== "worker") {
        return;
      }

      const cssChunks = Object.values(bundle).filter(
        (chunk) => chunk.type === "asset" && chunk.fileName.endsWith(".css"),
      );

      for (const [moduleId, cssContent] of cssMap.entries()) {
        const containingChunk = cssChunks.find((cssChunk) => {
          if (
            cssChunk.type !== "asset" ||
            typeof cssChunk.source !== "string"
          ) {
            return false;
          }
          return cssChunk.source.includes(cssContent);
        });

        if (containingChunk && containingChunk.type === "asset") {
          rscCssMap[moduleId] = `/${containingChunk.fileName}`;
        }
      }

      const outputDir = path.dirname(rscCssMapPath);
      await fs.mkdir(outputDir, { recursive: true });
      await fs.writeFile(rscCssMapPath, JSON.stringify(rscCssMap, null, 2));
    },
  };
}
