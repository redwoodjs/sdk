export const getLookupCandidates = (id: string) => {
  const candidates = [id];
  const querylessId = id.split("?", 1)[0];

  if (querylessId !== id) {
    candidates.push(querylessId);
  }

  return candidates;
};
