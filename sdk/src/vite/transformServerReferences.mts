import { relative } from "node:path";
import MagicString from "magic-string";
import debug from "debug";
import { parse } from "es-module-lexer";
import {
  getRealPathFromSSRNamespace,
  ensureSSRNamespace,
} from "./virtualizedSSRPlugin.mjs";

export interface TransformServerEnv {
  environmentName: string;
  isEsbuild?: boolean;
  isSSR?: boolean;
  topLevelRoot?: string;
}

export interface TransformResult {
  code: string;
  map?: any;
}

const logVite = debug("rwsdk:vite:transform-server-references:vite");
const logEsbuild = debug("rwsdk:vite:transform-server-references:esbuild");

export async function transformServerReferences(
  code: string,
  id: string,
  env: TransformServerEnv,
): Promise<TransformResult | undefined> {
  const log = env.isEsbuild ? logEsbuild : logVite;
  log(
    "Called transformServerReferences for id: **id** ==> %s, env: %O",
    id,
    env,
  );

  // Only transform files that start with 'use server'
  const cleanCode = code.trimStart();
  const hasUseServer =
    cleanCode.startsWith('"use server"') ||
    cleanCode.startsWith("'use server'");
  if (!hasUseServer) {
    log("Skipping: no 'use server' directive in **id** ==> %s", id);
    if (process.env.VERBOSE) {
      log(
        "[VERBOSE] Returning code unchanged for **id** ==> %s:\n%s",
        id,
        code,
      );
    }
    return;
  }
  log("Processing 'use server' module: **id** ==> %s", id);

  // Remove all 'use server' directives
  let s = new MagicString(code);
  s.replaceAll("'use server'", "");
  s.replaceAll('"use server"', "");
  s.trim();

  // Parse exports
  await import("es-module-lexer"); // ensure parse is initialized
  const [_, exports] = parse(code);
  log("Parsed exports for id: %s: %O", id, exports);

  // Compute relativeId for registration
  let relativeId = id;
  if (env.topLevelRoot) {
    try {
      relativeId = `/${relative(env.topLevelRoot, id)}`;
      log("Computed relativeId for id: %s: %s", id, relativeId);
    } catch (e) {
      log("Error computing relativeId for id: %s: %O", id, e);
    }
  }

  let importLines: string[] = [];
  let exportLines: string[] = [];
  if (env.isSSR) {
    log("SSR import detected for id: %s", id);
    // Just re-export everything from the original module in SSR
    importLines.push(
      `export * from ${JSON.stringify(getRealPathFromSSRNamespace(id))};`,
    );
    exportLines = [];
  } else if (env.environmentName === "worker") {
    log("Worker environment detected for id: %s", id);
    importLines.push('import { registerServerReference } from "rwsdk/worker";');
    importLines.push(`import ${JSON.stringify(ensureSSRNamespace(id))};`);
    for (const e of exports) {
      log("Registering server reference for export: %O in id: %s", e, id);
      exportLines.push(
        `registerServerReference(${e.ln}, ${JSON.stringify(relativeId)}, ${JSON.stringify(e.ln)});`,
      );
    }
  } else if (env.environmentName === "client") {
    log("Client environment detected for id: %s", id);
    importLines.push('import { createServerReference } from "rwsdk/client";');
    for (const e of exports) {
      log("Creating client server reference for export: %O in id: %s", e, id);
      exportLines.push(
        `export const ${e.ln} = createServerReference(${JSON.stringify(relativeId)}, ${JSON.stringify(e.ln)});`,
      );
    }
  }

  log("Processing complete for id: %s", id);

  const result = [...importLines, ...exportLines].join("\n");

  if (process.env.VERBOSE) {
    log("[VERBOSE] Transformed code for **id** ==> %s:\n%s", id, result);
  }

  return {
    code: result + "\n",
    map: s.generateMap({ hires: true }),
  };
}
