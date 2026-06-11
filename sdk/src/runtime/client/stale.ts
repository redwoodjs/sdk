import {
  CLIENT_VERSION_HEADER,
  STALE_RESPONSE_HEADER,
  STALE_RESPONSE_VALUE_RELOAD,
} from "../lib/stale.js";

export function getClientBuildVersion(): string | undefined {
  return import.meta.env.VITE_RWSDK_BUILD_ID;
}

export function isStaleReloadResponse(response: Response): boolean {
  return (
    response.headers?.get(STALE_RESPONSE_HEADER) === STALE_RESPONSE_VALUE_RELOAD
  );
}

export function createClientVersionHeaders(
  extraHeaders?: Record<string, string>,
): Headers {
  const headers = new Headers();
  const clientBuildVersion = getClientBuildVersion();
  if (clientBuildVersion) {
    headers.set(CLIENT_VERSION_HEADER, clientBuildVersion);
  }
  if (extraHeaders) {
    for (const [key, value] of Object.entries(extraHeaders)) {
      headers.set(key, value);
    }
  }
  return headers;
}

export { CLIENT_VERSION_HEADER };
