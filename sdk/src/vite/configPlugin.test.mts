import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "vite";
import { describe, expect, it } from "vitest";
import { SSR_BRIDGE_ROLLDOWN_EXPERIMENTAL } from "./configPlugin.mjs";

describe("SSR bridge Rolldown options", () => {
  it("keeps side-effect-free barrels valid when code splitting is disabled", async () => {
    const root = await mkdtemp(
      path.join(tmpdir(), "rwsdk-ssr-bridge-lazy-barrel-"),
    );

    try {
      await mkdir(path.join(root, "src", "lib"), { recursive: true });
      await writeFile(
        path.join(root, "package.json"),
        JSON.stringify({ type: "module", private: true, sideEffects: false }),
      );
      await writeFile(
        path.join(root, "src", "lib", "eg.js"),
        `const primitives = { string: { tag: "s" }, number: { tag: "n" } };
const higher = { object: (shape) => ({ tag: "o", shape, parse: () => true }) };
export const eg = { ...primitives, ...higher };
`,
      );
      await writeFile(
        path.join(root, "src", "lib", "account.js"),
        `import { eg } from "./eg.js";
export const AccountSettings = eg.object({ a: eg.string, n: eg.number });
export const AccountMeta = eg.object({ b: eg.string });
`,
      );
      await writeFile(
        path.join(root, "src", "lib", "index.js"),
        `export * from "./account.js";
export const objectKeys = (o) => Object.keys(o);
`,
      );
      await writeFile(
        path.join(root, "src", "story.js"),
        `import { objectKeys } from "./lib/index.js";
export const run = () => (objectKeys ? "ok" : "no");
`,
      );
      await writeFile(
        path.join(root, "src", "entry.cjs"),
        `const { run } = require("./story.js");
console.log(run());
`,
      );

      await build({
        configFile: false,
        root,
        logLevel: "silent",
        build: {
          ssr: true,
          minify: true,
          outDir: path.join(root, "dist"),
          emptyOutDir: true,
          lib: {
            entry: {
              index: path.join(root, "src", "entry.cjs"),
            },
            formats: ["es"],
            fileName: () => "index.js",
          },
          rolldownOptions: {
            experimental: SSR_BRIDGE_ROLLDOWN_EXPERIMENTAL,
            output: {
              codeSplitting: false,
            },
          },
        },
      });

      const outputPath = path.join(root, "dist", "index.js");
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (...args: unknown[]) => {
        logs.push(args.join(" "));
      };
      try {
        await import(pathToFileURL(outputPath).href);
      } finally {
        console.log = originalLog;
      }

      expect(logs).toContain("ok");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
