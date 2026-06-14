import { normalizePath } from "vite";

export type ViteRscClientReferenceMeta = {
  importId: string;
  referenceKey: string;
  exportNames: string[];
};

export type ViteRscClientReferenceLookupEntry = {
  key: string;
  importId: string;
};

export const normalizeViteRscClientReferenceId = (id: string) =>
  normalizePath(id.replace(/\\/g, "/")).replace(/^[A-Z]:\//, (drive) =>
    drive.toLowerCase(),
  );

const splitExportSuffix = (id: string) => {
  const hashIndex = id.indexOf("#");
  return hashIndex === -1
    ? { pathPart: id, exportPart: "" }
    : { pathPart: id.slice(0, hashIndex), exportPart: id.slice(hashIndex) };
};

const stripViteTimestampQuery = (id: string) => {
  const { pathPart, exportPart } = splitExportSuffix(id);
  return pathPart.split("?", 1)[0] + exportPart;
};

const stripPluginRscCacheTag = (id: string) => {
  const { pathPart, exportPart } = splitExportSuffix(id);
  return pathPart.replace(/\$\$cache=[^?#]+/, "") + exportPart;
};

const createLookupKeyVariants = (key: string) => {
  const normalizedKey = normalizeViteRscClientReferenceId(key);
  const queryless = stripViteTimestampQuery(normalizedKey);
  const cacheless = stripPluginRscCacheTag(normalizedKey);

  return new Set([
    normalizedKey,
    queryless,
    cacheless,
    stripPluginRscCacheTag(queryless),
    stripViteTimestampQuery(cacheless),
  ]);
};

export function generateViteRscClientReferenceLookupEntries({
  clientReferenceMetaMap,
  legacyClientFiles = [],
  projectRootDir,
}: {
  clientReferenceMetaMap: Record<string, ViteRscClientReferenceMeta>;
  legacyClientFiles?: Iterable<string>;
  projectRootDir?: string;
}): ViteRscClientReferenceLookupEntry[] {
  const entries = new Map<string, string>();
  const normalizedRoot = projectRootDir
    ? normalizeViteRscClientReferenceId(projectRootDir).replace(/\/$/, "")
    : undefined;

  const add = (key: string | undefined, importId: string | undefined) => {
    if (!key || !importId) {
      return;
    }
    const normalizedImportId = normalizeViteRscClientReferenceId(importId);

    for (const keyVariant of createLookupKeyVariants(key)) {
      if (!entries.has(keyVariant)) {
        entries.set(keyVariant, normalizedImportId);
      }
    }
  };

  const rootRelative = (id: string) => {
    const normalizedId = normalizeViteRscClientReferenceId(id);
    if (normalizedRoot && normalizedId.startsWith(`${normalizedRoot}/`)) {
      return normalizedId.slice(normalizedRoot.length + 1);
    }
    return normalizedId;
  };

  for (const file of legacyClientFiles) {
    add(file, file);
  }

  for (const [id, meta] of Object.entries(clientReferenceMetaMap)) {
    const importId = normalizeViteRscClientReferenceId(meta.importId);
    const sourceId = normalizeViteRscClientReferenceId(id);
    const rootRelativeSourceId = rootRelative(sourceId);

    add(importId, importId);
    add(meta.referenceKey, importId);
    add(sourceId, importId);
    add(rootRelativeSourceId, importId);
    add(`/${rootRelativeSourceId}`, importId);

    for (const exportName of meta.exportNames) {
      add(`${meta.referenceKey}#${exportName}`, importId);
      add(`${importId}#${exportName}`, importId);
      add(`${rootRelativeSourceId}#${exportName}`, importId);
      add(`/${rootRelativeSourceId}#${exportName}`, importId);
    }
  }

  return Array.from(entries.entries()).map(([key, importId]) => ({
    key,
    importId,
  }));
}
