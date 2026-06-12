import { Lang, Lang as SgLang, parse as sgParse } from "@ast-grep/napi";
import { getPluginApi } from "@vitejs/plugin-rsc/plugin";
import MagicString from "magic-string";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { Plugin, ResolvedConfig } from "vite";
import debug from "debug";
import { normalizeModulePath } from "../lib/normalizeModulePath.mjs";
import { hasDirective } from "./hasDirective.mjs";

export type RedwoodServerReferenceMetadata = {
  moduleId: string;
  exportName: string;
  source: "action" | "query";
  method: "GET" | "POST";
};

type MetadataMap = Map<string, RedwoodServerReferenceMetadata>;

type ReExportMetadata = {
  exportName: string;
  originalName: string;
  moduleSpecifier: string;
};

const log = debug("rwsdk:vite:vite-rsc-server-reference-bridge");

const metadataKey = (moduleId: string, exportName: string) =>
  `${moduleId}#${exportName}`;

const langForId = (id: string) => {
  const ext = path.extname(id).toLowerCase();
  return ext === ".tsx" || ext === ".jsx" ? Lang.Tsx : SgLang.TypeScript;
};

export function collectRedwoodServerReferenceReExports(
  code: string,
  moduleId: string,
): ReExportMetadata[] {
  if (!hasDirective(code, "use server")) {
    return [];
  }

  const results: ReExportMetadata[] = [];
  const reExportPattern =
    /export\s*{([^}]+)}\s*from\s*(["'])([^"']+)\2\s*;?/g;

  for (const match of code.matchAll(reExportPattern)) {
    const specifiers = match[1];
    const moduleSpecifier = match[3];

    for (const rawSpecifier of specifiers.split(",")) {
      const specifier = rawSpecifier.trim();
      if (!specifier) {
        continue;
      }

      const [originalName, exportName = originalName] = specifier
        .split(/\s+as\s+/)
        .map((part) => part.trim());

      if (originalName && exportName) {
        results.push({ exportName, originalName, moduleSpecifier });
      }
    }
  }

  return results;
}

export function collectRedwoodServerReferenceMetadata(
  code: string,
  moduleId: string,
): RedwoodServerReferenceMetadata[] {
  if (!hasDirective(code, "use server")) {
    return [];
  }

  const root = sgParse(langForId(moduleId), code).root();
  const results: RedwoodServerReferenceMetadata[] = [];

  const add = ({
    exportName,
    source,
    method,
  }: Omit<RedwoodServerReferenceMetadata, "moduleId">) => {
    const existing = results.find((item) => item.exportName === exportName);
    if (!existing) {
      results.push({ moduleId, exportName, source, method });
    }
  };

  for (const match of root.findAll(
    'export const $NAME = serverQuery($$$, { method: "$METHOD" })',
  )) {
    const exportName = match.getMatch("NAME")?.text();
    const method = match.getMatch("METHOD")?.text();
    if (exportName && (method === "GET" || method === "POST")) {
      add({ exportName, source: "query", method });
    }
  }

  for (const match of root.findAll("export const $NAME = serverQuery($$$)")) {
    const exportName = match.getMatch("NAME")?.text();
    if (exportName) {
      add({ exportName, source: "query", method: "GET" });
    }
  }

  for (const match of root.findAll("export const $NAME = serverAction($$$)")) {
    const exportName = match.getMatch("NAME")?.text();
    if (exportName) {
      add({ exportName, source: "action", method: "POST" });
    }
  }

  for (const match of root.findAll(
    'export default serverQuery($$$, { method: "$METHOD" })',
  )) {
    const method = match.getMatch("METHOD")?.text();
    if (method === "GET" || method === "POST") {
      add({ exportName: "default", source: "query", method });
    }
  }

  if (root.find("export default serverQuery($$$)")) {
    add({ exportName: "default", source: "query", method: "GET" });
  }

  if (root.find("export default serverAction($$$)")) {
    add({ exportName: "default", source: "action", method: "POST" });
  }

  return results;
}

export function rewritePluginRscServerReferences({
  code,
  environmentName,
  metadataByKey,
  referenceKeyToModuleId,
}: {
  code: string;
  environmentName: "client" | "ssr";
  metadataByKey: MetadataMap;
  referenceKeyToModuleId: Map<string, string>;
}): string | undefined {
  if (!code.includes("createServerReference")) {
    return;
  }

  const importSource = environmentName === "ssr" ? "rwsdk/__ssr" : "rwsdk/client";
  const s = new MagicString(code);
  let changed = false;
  let externalBridgeImportNeeded = false;

  const nil = String.raw`(?:undefined|void 0)`;
  const referenceCallPattern = new RegExp(
    String.raw`\$\$ReactClient\.createServerReference\(\s*(["'])([^"']+)\1\s*,\s*\$\$ReactClient\.callServer\s*,\s*${nil}\s*,\s*(?:${nil}|\$\$ReactClient\.findSourceMapURL)\s*,\s*(["'])([^"']+)\3\s*\)`,
    "g",
  );

  for (const match of code.matchAll(referenceCallPattern)) {
    const fullReferenceId = match[2];
    const exportName = match[4];
    const hashIndex = fullReferenceId.lastIndexOf("#");
    if (hashIndex === -1) {
      continue;
    }

    const referenceKey = fullReferenceId.slice(0, hashIndex);
    const moduleId = referenceKeyToModuleId.get(referenceKey) ?? referenceKey;
    if (!moduleId) {
      continue;
    }

    const metadata = metadataByKey.get(metadataKey(moduleId, exportName));
    if (!metadata) {
      continue;
    }

    s.overwrite(
      match.index!,
      match.index! + match[0].length,
      `$$RedwoodServerReference.createRedwoodServerReference(${JSON.stringify(moduleId)}, ${JSON.stringify(exportName)}, { method: ${JSON.stringify(metadata.method)}, source: ${JSON.stringify(metadata.source)} })`,
    );
    changed = true;
    externalBridgeImportNeeded = true;
  }

  const redwoodReferenceCallPattern =
    /(?<!\.)createServerReference\(\s*(["'])([^"']+)\1\s*,\s*(["'])([^"']+)\3\s*\)/g;

  for (const match of code.matchAll(redwoodReferenceCallPattern)) {
    const moduleId = match[2];
    const exportName = match[4];
    const metadata = metadataByKey.get(metadataKey(moduleId, exportName));
    if (!metadata) {
      continue;
    }

    s.overwrite(
      match.index!,
      match.index! + match[0].length,
      `createServerReference(${JSON.stringify(moduleId)}, ${JSON.stringify(exportName)}, ${JSON.stringify(metadata.method)}, ${JSON.stringify(metadata.source)})`,
    );
    changed = true;
  }

  if (!changed) {
    return;
  }

  if (externalBridgeImportNeeded) {
    s.prepend(
      `import * as $$RedwoodServerReference from ${JSON.stringify(importSource)};\n`,
    );
  }

  return s.toString();
}

export const viteRscServerReferenceBridgePlugin = ({
  projectRootDir,
}: {
  projectRootDir: string;
}): Plugin[] => {
  const metadataByKey: MetadataMap = new Map();
  const visitedMetadataFiles = new Set<string>();
  let config: ResolvedConfig;

  const resolveRelativeModuleFile = (fromFilePath: string, specifier: string) => {
    if (!specifier.startsWith(".")) {
      return;
    }

    const base = path.resolve(path.dirname(fromFilePath), specifier);
    const candidates = [
      base,
      `${base}.ts`,
      `${base}.tsx`,
      `${base}.js`,
      `${base}.jsx`,
      path.join(base, "index.ts"),
      path.join(base, "index.tsx"),
      path.join(base, "index.js"),
      path.join(base, "index.jsx"),
    ];

    return candidates.find((candidate) => existsSync(candidate));
  };

  const collectMetadataFromFile = (id: string) => {
    const filePath = id.split("?", 1)[0];
    if (visitedMetadataFiles.has(filePath)) {
      return;
    }
    visitedMetadataFiles.add(filePath);

    const moduleId = normalizeModulePath(filePath, projectRootDir);

    try {
      const code = readFileSync(filePath, "utf-8");
      for (const metadata of collectRedwoodServerReferenceMetadata(code, moduleId)) {
        metadataByKey.set(
          metadataKey(metadata.moduleId, metadata.exportName),
          metadata,
        );
      }

      for (const reExport of collectRedwoodServerReferenceReExports(code, moduleId)) {
        const targetFilePath = resolveRelativeModuleFile(
          filePath,
          reExport.moduleSpecifier,
        );
        if (!targetFilePath) {
          continue;
        }

        collectMetadataFromFile(targetFilePath);
        const targetModuleId = normalizeModulePath(targetFilePath, projectRootDir);
        const targetMetadata = metadataByKey.get(
          metadataKey(targetModuleId, reExport.originalName),
        );
        if (targetMetadata) {
          metadataByKey.set(metadataKey(moduleId, reExport.exportName), {
            moduleId,
            exportName: reExport.exportName,
            method: targetMetadata.method,
            source: targetMetadata.source,
          });
        }
      }
    } catch {
      // Ignore unreadable virtual/package ids. If no metadata is available, the
      // post-transform leaves plugin-rsc's reference untouched.
    }
  };

  const collectMetadataFromCodeReferences = (code: string) => {
    const referencePattern =
      /createServerReference\(\s*(["'])([^"']+)#([^"']+)\1\s*,/g;

    for (const match of code.matchAll(referencePattern)) {
      const referenceKey = match[2];
      if (referenceKey.startsWith("/")) {
        collectMetadataFromFile(path.join(projectRootDir, referenceKey));
      }
    }
  };

  const referenceKeyToModuleId = () => {
    const map = new Map<string, string>();
    const serverReferenceMetaMap =
      getPluginApi(config)?.manager.serverReferenceMetaMap ?? {};

    for (const meta of Object.values(serverReferenceMetaMap)) {
      collectMetadataFromFile(meta.importId);
      map.set(
        meta.referenceKey,
        normalizeModulePath(meta.importId, projectRootDir),
      );
    }

    return map;
  };

  return [
    {
      name: "rwsdk:vite-rsc-server-reference-metadata",
      enforce: "pre",
      configResolved(resolvedConfig) {
        config = resolvedConfig;
      },
      transform(code, id) {
        const moduleId = normalizeModulePath(id, projectRootDir);
        for (const metadata of collectRedwoodServerReferenceMetadata(
          code,
          moduleId,
        )) {
          metadataByKey.set(
            metadataKey(metadata.moduleId, metadata.exportName),
            metadata,
          );
        }
      },
    },
    {
      name: "rwsdk:vite-rsc-server-reference-bridge",
      enforce: "post",
      configResolved(resolvedConfig) {
        config = resolvedConfig;
      },
      transform(code, id) {
        if (this.environment.name !== "client" && this.environment.name !== "ssr") {
          return;
        }

        collectMetadataFromCodeReferences(code);

        if (code.includes("createServerReference")) {
          log(
            "inspecting %s %s module with %d metadata entries: %s",
            this.environment.name,
            id,
            metadataByKey.size,
            code.slice(0, 200).replace(/\s+/g, " "),
          );
        }

        const rewritten = rewritePluginRscServerReferences({
          code,
          environmentName: this.environment.name,
          metadataByKey,
          referenceKeyToModuleId: referenceKeyToModuleId(),
        });

        if (rewritten) {
          return { code: rewritten, map: null };
        }
      },
    },
  ];
};
