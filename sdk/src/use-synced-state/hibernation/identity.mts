const IDENTITY_QUERY_PARAM = "__ssi";

export type SyncedStateIdentity = unknown;

// context(justinvdm, 19 Jun 2026): Serialize the captured identity into a URL
// query parameter so the worker can pass it to the DO during the WebSocket
// upgrade. The identity is extracted from requestInfo in the worker and is not
// user-controlled, so passing it in the internal worker->DO request is safe.
export function setIdentityInUrl(
  identity: SyncedStateIdentity,
  url: URL,
): URL {
  url.searchParams.set(IDENTITY_QUERY_PARAM, JSON.stringify(identity));
  return url;
}

export function getIdentityFromUrl(url: URL): SyncedStateIdentity {
  const value = url.searchParams.get(IDENTITY_QUERY_PARAM);
  if (value === null) {
    return undefined;
  }
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

export function removeIdentityFromUrl(url: URL): URL {
  url.searchParams.delete(IDENTITY_QUERY_PARAM);
  return url;
}
