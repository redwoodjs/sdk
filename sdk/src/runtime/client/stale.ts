import {
  CLIENT_VERSION_HEADER,
  STALE_RESPONSE_HEADER,
  STALE_RESPONSE_VALUE_RELOAD,
  withClientVersionQuery,
} from "../lib/stale.js";

export function getClientBuildVersion(): string | undefined {
  return import.meta.env.VITE_RWSDK_BUILD_ID;
}

export function withClientVersionQueryString(urlLike: string): string {
  return withClientVersionQuery(urlLike, getClientBuildVersion());
}

export function isStaleReloadResponse(response: Response): boolean {
  return response.headers?.get(STALE_RESPONSE_HEADER) === STALE_RESPONSE_VALUE_RELOAD;
}

export { CLIENT_VERSION_HEADER };
