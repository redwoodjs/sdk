const IDENTITY_QUERY_PARAM = "__ssi";
const MAX_IDENTITY_SIZE_BYTES = 4096;

export type SyncedStateIdentity = unknown;

export class SyncedStateIdentityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SyncedStateIdentityError";
  }
}

// context(justinvdm, 29 Jun 2026): Serialize the captured identity into a URL
// query parameter so the worker can pass it to the DO during the WebSocket
// upgrade. The identity is extracted from requestInfo in the worker and is not
// user-controlled, so passing it in the internal worker->DO request is safe.
// We validate serializability and size here so a bad extractor fails the
// handshake with a clear error instead of an opaque internal failure.
export function setIdentityInUrl(
  identity: SyncedStateIdentity,
  url: URL,
): URL {
  let serialized: string;
  try {
    serialized = JSON.stringify(identity);
  } catch (error) {
    throw new SyncedStateIdentityError(
      `useSyncedState identity must be JSON-serializable: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (serialized.length > MAX_IDENTITY_SIZE_BYTES) {
    throw new SyncedStateIdentityError(
      `useSyncedState identity exceeds maximum size of ${MAX_IDENTITY_SIZE_BYTES} bytes`,
    );
  }

  url.searchParams.set(IDENTITY_QUERY_PARAM, serialized);
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
