const splitExportSuffix = (id: string) => {
  const hashIndex = id.indexOf("#");
  return hashIndex === -1
    ? { pathPart: id, exportPart: "" }
    : { pathPart: id.slice(0, hashIndex), exportPart: id.slice(hashIndex) };
};

const stripViteQuery = (id: string) => {
  const { pathPart, exportPart } = splitExportSuffix(id);
  return pathPart.split("?", 1)[0] + exportPart;
};

const stripPluginRscCacheTag = (id: string) => {
  const { pathPart, exportPart } = splitExportSuffix(id);
  return pathPart.replace(/\$\$cache=[^?#]+/, "") + exportPart;
};

export const getLookupCandidates = (id: string) => {
  const candidates = new Set([id]);
  const querylessId = stripViteQuery(id);

  candidates.add(querylessId);
  candidates.add(stripPluginRscCacheTag(id));
  candidates.add(stripPluginRscCacheTag(querylessId));
  candidates.add(stripViteQuery(stripPluginRscCacheTag(id)));

  return Array.from(candidates);
};
