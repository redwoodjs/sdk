export const STALE_RESPONSE_HEADER = "x-rwsdk-stale";
export const STALE_RESPONSE_VALUE_RELOAD = "reload";
export const CLIENT_VERSION_HEADER = "x-rwsdk-client-version";
export const CLIENT_VERSION_QUERY = "__rwsdk_client_version";

export type StaleSource = "core" | "asset" | "synced-state";
export type StaleReason =
  | "client-version-mismatch"
  | "asset-version-mismatch"
  | "synced-state-version-mismatch";

export interface StaleEvent {
  request: Request;
  source: StaleSource;
  currentVersion: string;
  clientVersion: string;
  reason: StaleReason;
}

export function getClientVersionFromRequest(
  request: Request,
): string | undefined {
  const headerVersion = request.headers.get(CLIENT_VERSION_HEADER)?.trim();
  if (headerVersion) {
    return headerVersion;
  }

  const url = new URL(request.url);
  const queryVersion = url.searchParams.get(CLIENT_VERSION_QUERY)?.trim();
  if (queryVersion) {
    return queryVersion;
  }
}

export function isStaleRequest(
  request: Request,
  source: StaleSource,
  currentVersion: string | undefined,
): boolean {
  if (!currentVersion) {
    return false;
  }

  const clientVersion = getClientVersionFromRequest(request);
  return !!clientVersion && clientVersion !== currentVersion;
}

export function buildStaleEvent(
  request: Request,
  source: StaleSource,
  currentVersion: string,
): StaleEvent {
  const clientVersion = getClientVersionFromRequest(request)!;

  const reason: StaleReason =
    source === "asset"
      ? "asset-version-mismatch"
      : source === "synced-state"
        ? "synced-state-version-mismatch"
        : "client-version-mismatch";

  return {
    request,
    source,
    currentVersion,
    clientVersion,
    reason,
  };
}

export function createStaleReloadResponse(): Response {
  return new Response(null, {
    status: 409,
    headers: {
      [STALE_RESPONSE_HEADER]: STALE_RESPONSE_VALUE_RELOAD,
      "cache-control": "no-store",
    },
  });
}

export function addClientVersionToUrl(
  urlLike: string,
  clientVersion: string | undefined,
): string {
  if (!clientVersion) {
    return urlLike;
  }

  const baseUrl =
    typeof window !== "undefined" ? window.location.href : "http://localhost";
  const url = new URL(urlLike, baseUrl);
  url.searchParams.set(CLIENT_VERSION_QUERY, clientVersion);
  return url.toString();
}
