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

const stripViteTimestampQuery = (id: string) => {
  const hashIndex = id.indexOf("#");
  const pathPart = hashIndex === -1 ? id : id.slice(0, hashIndex);
  const exportPart = hashIndex === -1 ? "" : id.slice(hashIndex);
  return pathPart.split("?", 1)[0] + exportPart;
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
    const normalizedKey = normalizeViteRscClientReferenceId(key);
    const normalizedImportId = normalizeViteRscClientReferenceId(importId);
    const keyVariants = new Set([
      normalizedKey,
      stripViteTimestampQuery(normalizedKey),
    ]);

    for (const keyVariant of keyVariants) {
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
