export type ClientReferenceDeps =
  | string[]
  | {
      js?: string[];
      css?: string[];
    };

export type ViteRscClientReferenceMeta = {
  importId: string;
  referenceKey: string;
  packageSource?: string;
  exportNames: string[];
  renderedExports?: string[];
  serverChunk?: string;
  groupChunkId?: string;
};

export type ViteRscClientReferenceMetaMap = Record<
  string,
  ViteRscClientReferenceMeta
>;

export type RedwoodRscManifestEntry = {
  id: string;
  name: string | symbol;
  chunks: string[];
  async: boolean;
};

export type ViteRscManifestAdapterOptions = {
  clientReferenceMetaMap: ViteRscClientReferenceMetaMap;
  clientReferenceDeps?: Record<string, ClientReferenceDeps>;
  projectRootDir?: string;
  useAssetChunks?: boolean;
};

type ResolvedReference = {
  referenceKey: string;
  exportName?: string;
};

const normalizeReferenceId = (id: string) =>
  id.replace(/\\/g, "/").replace(/^[A-Z]:\//, (drive) => drive.toLowerCase());

const stripViteQuery = (id: string) => {
  const hashIndex = id.indexOf("#");
  const pathPart = hashIndex === -1 ? id : id.slice(0, hashIndex);
  const exportPart = hashIndex === -1 ? "" : id.slice(hashIndex);
  return pathPart.split("?", 1)[0] + exportPart;
};

const createFallbackClientManifestEntry = (
  key: string | symbol,
): RedwoodRscManifestEntry => {
  if (typeof key === "string") {
    const hashIndex = key.lastIndexOf("#");
    if (hashIndex !== -1) {
      return {
        id: key.slice(0, hashIndex),
        name: key.slice(hashIndex + 1),
        chunks: [],
        async: true,
      };
    }
  }

  return { id: String(key), name: key, chunks: [], async: true };
};

const normalizeRoot = (projectRootDir: string | undefined) =>
  projectRootDir
    ? normalizeReferenceId(projectRootDir).replace(/\/$/, "")
    : undefined;

const createRootRelative = (projectRootDir: string | undefined) => {
  const root = normalizeRoot(projectRootDir);
  return (id: string) => {
    const normalized = normalizeReferenceId(id);
    if (root && normalized.startsWith(`${root}/`)) {
      return normalized.slice(root.length + 1);
    }
    return normalized;
  };
};

const createReferenceResolver = ({
  clientReferenceMetaMap,
  projectRootDir,
}: Pick<
  ViteRscManifestAdapterOptions,
  "clientReferenceMetaMap" | "projectRootDir"
>) => {
  const aliases = new Map<string, ResolvedReference>();
  const rootRelative = createRootRelative(projectRootDir);

  const add = (key: string | undefined, referenceKey: string, exportName?: string) => {
    if (!key) {
      return;
    }

    const normalizedKey = normalizeReferenceId(key);
    for (const keyVariant of new Set([
      normalizedKey,
      stripViteQuery(normalizedKey),
    ])) {
      if (!aliases.has(keyVariant)) {
        aliases.set(keyVariant, { referenceKey, exportName });
      }
    }
  };

  for (const [sourceId, meta] of Object.entries(clientReferenceMetaMap)) {
    const importId = normalizeReferenceId(meta.importId);
    const normalizedSourceId = normalizeReferenceId(sourceId);
    const rootRelativeImportId = rootRelative(importId);
    const rootRelativeSourceId = rootRelative(normalizedSourceId);

    add(meta.referenceKey, meta.referenceKey);
    add(importId, meta.referenceKey);
    add(normalizedSourceId, meta.referenceKey);
    add(rootRelativeImportId, meta.referenceKey);
    add(rootRelativeSourceId, meta.referenceKey);
    add(`/${rootRelativeImportId}`, meta.referenceKey);
    add(`/${rootRelativeSourceId}`, meta.referenceKey);

    for (const exportName of meta.exportNames) {
      add(`${meta.referenceKey}#${exportName}`, meta.referenceKey, exportName);
      add(`${importId}#${exportName}`, meta.referenceKey, exportName);
      add(`${normalizedSourceId}#${exportName}`, meta.referenceKey, exportName);
      add(`${rootRelativeImportId}#${exportName}`, meta.referenceKey, exportName);
      add(`${rootRelativeSourceId}#${exportName}`, meta.referenceKey, exportName);
      add(`/${rootRelativeImportId}#${exportName}`, meta.referenceKey, exportName);
      add(`/${rootRelativeSourceId}#${exportName}`, meta.referenceKey, exportName);
    }
  }

  return (key: string) => aliases.get(normalizeReferenceId(key));
};

const chunksForReference = ({
  clientReferenceDeps,
  referenceKey,
  useAssetChunks,
}: {
  clientReferenceDeps?: Record<string, ClientReferenceDeps>;
  referenceKey: string;
  useAssetChunks?: boolean;
}) => {
  if (!useAssetChunks) {
    return [];
  }

  const deps = clientReferenceDeps?.[referenceKey];
  if (!deps) {
    return [];
  }

  return Array.isArray(deps) ? deps : [...(deps.js ?? []), ...(deps.css ?? [])];
};

const createEntry = ({
  clientReferenceDeps,
  resolved,
  useAssetChunks,
}: {
  clientReferenceDeps?: Record<string, ClientReferenceDeps>;
  resolved: ResolvedReference;
  useAssetChunks?: boolean;
}): RedwoodRscManifestEntry => ({
  id: resolved.referenceKey,
  name: resolved.exportName ?? resolved.referenceKey,
  chunks: chunksForReference({
    clientReferenceDeps,
    referenceKey: resolved.referenceKey,
    useAssetChunks,
  }),
  async: true,
});

export function createClientManifestFromViteRsc({
  clientReferenceMetaMap,
  clientReferenceDeps,
  projectRootDir,
  useAssetChunks = false,
}: ViteRscManifestAdapterOptions) {
  const resolveReference = createReferenceResolver({
    clientReferenceMetaMap,
    projectRootDir,
  });

  return new Proxy<ClientManifest>(
    {},
    {
      get(_, key) {
        if (typeof key === "string") {
          const resolved = resolveReference(key);
          if (resolved?.exportName) {
            return createEntry({
              clientReferenceDeps,
              resolved,
              useAssetChunks,
            });
          }
        }

        return createFallbackClientManifestEntry(key);
      },
    },
  );
}

export function createModuleMapFromViteRsc({
  clientReferenceMetaMap,
  clientReferenceDeps,
  projectRootDir,
  useAssetChunks = false,
}: ViteRscManifestAdapterOptions) {
  const resolveReference = createReferenceResolver({
    clientReferenceMetaMap,
    projectRootDir,
  });

  return new Proxy(
    {},
    {
      get(_, id: string) {
        return new Proxy<ClientManifest>(
          {},
          {
            get(_, name) {
              if (typeof name === "string") {
                const resolved = resolveReference(`${id}#${name}`);
                if (resolved) {
                  return createEntry({
                    clientReferenceDeps,
                    resolved,
                    useAssetChunks,
                  });
                }
              }

              return {
                id,
                name,
                chunks: [],
                async: true,
              };
            },
          },
        );
      },
    },
  );
}
