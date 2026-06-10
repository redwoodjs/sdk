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

const STALE_RELOAD_KEY = "rwsdk:stale-reload";

export function triggerStaleReload(): void {
  try {
    if (sessionStorage.getItem(STALE_RELOAD_KEY)) {
      return;
    }
    sessionStorage.setItem(STALE_RELOAD_KEY, "1");
  } catch {
    // Storage can be unavailable. We still attempt a reload once.
  }

  window.location.reload();
}

export function clearStaleReloadGuard(): void {
  try {
    sessionStorage.removeItem(STALE_RELOAD_KEY);
  } catch {
    // Ignore storage unavailability.
  }
}

export function handleStaleResponse(response: Response): boolean {
  if (!isStaleReloadResponse(response)) {
    return false;
  }

  triggerStaleReload();
  return true;
}

export { CLIENT_VERSION_HEADER };
