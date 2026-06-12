const toPnpmFileDependencyAlias = (id: string) => {
  const match = id.match(
    /^\/node_modules\/\.pnpm\/([^/]+)\/node_modules\/((?:@[^/]+\/)?[^/]+)(\/.*)$/,
  );

  if (!match) {
    return undefined;
  }

  const [, pnpmPackageFolder, , packageRelativePath] = match;
  const fileMarker = "@file+";
  const fileMarkerIndex = pnpmPackageFolder.indexOf(fileMarker);

  if (fileMarkerIndex === -1) {
    return undefined;
  }

  const encodedSourcePath = pnpmPackageFolder
    .slice(fileMarkerIndex + fileMarker.length)
    .split("_", 1)[0];

  if (!encodedSourcePath) {
    return undefined;
  }

  return `/${encodedSourcePath.replaceAll("+", "/")}${packageRelativePath}`;
};

export const getLookupCandidates = (id: string) => {
  const candidates = [id];
  const querylessId = id.split("?", 1)[0];

  if (querylessId !== id) {
    candidates.push(querylessId);
  }

  const pnpmAlias = toPnpmFileDependencyAlias(querylessId);
  if (pnpmAlias) {
    candidates.push(pnpmAlias);
  }

  return candidates;
};
