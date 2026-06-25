import React, { useContext, useSyncExternalStore } from "react";

import {
  getNavigationSnapshot,
  isSameNavigationDocumentUrl,
  subscribeNavigationState,
  type NavigationSnapshot,
} from "./navigationState.js";
import type { RscPayloadMeta } from "./types.js";

export type NavigationSearchParamsWatch = boolean | readonly string[];

export interface NavigationPendingWatch {
  /** Watch pathname changes. Defaults to true when using a watch config. */
  pathname?: boolean;
  /** Watch all search params, no search params, or a specific list of params. */
  searchParams?: NavigationSearchParamsWatch;
  /** Watch hash changes. Defaults to false when using a watch config. */
  hash?: boolean;
}

export interface NavigationPendingWhenArgs {
  currentUrl: URL;
  pendingUrl: URL;
}

export interface NavigationPendingOptions {
  /** Shorthand for watching only these search params. */
  searchParams?: readonly string[];
  /** Explicit URL parts to watch. */
  watch?: NavigationPendingWatch;
  /** Advanced predicate for deciding whether the pending navigation is relevant. */
  when?: (args: NavigationPendingWhenArgs) => boolean;
}

export interface NavigationPendingProps extends NavigationPendingOptions {
  children?: React.ReactNode;
}

const NO_NAVIGATION_PAYLOAD_META = Symbol("NO_NAVIGATION_PAYLOAD_META");
type NavigationPayloadMetaContextValue =
  | RscPayloadMeta
  | undefined
  | typeof NO_NAVIGATION_PAYLOAD_META;

const NavigationPayloadMetaContext =
  React.createContext<NavigationPayloadMetaContextValue>(
    NO_NAVIGATION_PAYLOAD_META,
  );

export function NavigationPayloadProvider({
  children,
  meta,
}: {
  children?: React.ReactNode;
  meta?: RscPayloadMeta;
}) {
  return (
    <NavigationPayloadMetaContext.Provider value={meta}>
      {children}
    </NavigationPayloadMetaContext.Provider>
  );
}

function cloneUrl(url: URL) {
  return new URL(url.href);
}

function arraysEqual(left: readonly string[], right: readonly string[]) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function searchParamChanged(currentUrl: URL, pendingUrl: URL, name: string) {
  return !arraysEqual(
    currentUrl.searchParams.getAll(name),
    pendingUrl.searchParams.getAll(name),
  );
}

function searchParamsChanged(
  currentUrl: URL,
  pendingUrl: URL,
  watch: NavigationSearchParamsWatch,
) {
  if (watch === false) {
    return false;
  }

  if (watch === true) {
    return currentUrl.search !== pendingUrl.search;
  }

  return watch.some((name) => searchParamChanged(currentUrl, pendingUrl, name));
}

function watchedUrlChanged(
  currentUrl: URL,
  pendingUrl: URL,
  watch: NavigationPendingWatch,
) {
  const watchPathname = watch.pathname ?? true;
  const watchSearchParams = watch.searchParams ?? true;
  const watchHash = watch.hash ?? false;

  if (watchPathname && currentUrl.pathname !== pendingUrl.pathname) {
    return true;
  }

  if (searchParamsChanged(currentUrl, pendingUrl, watchSearchParams)) {
    return true;
  }

  if (watchHash && currentUrl.hash !== pendingUrl.hash) {
    return true;
  }

  return false;
}

function isRenderingMatchingNavigationPayload(
  snapshot: NavigationSnapshot,
  meta: NavigationPayloadMetaContextValue,
) {
  const pending = snapshot.pending;

  if (!pending) {
    return false;
  }

  if (meta === NO_NAVIGATION_PAYLOAD_META) {
    return false;
  }

  if (meta === undefined) {
    return true;
  }

  if (meta.source !== "navigation") {
    return false;
  }

  if (!meta.href) {
    return true;
  }

  try {
    return isSameNavigationDocumentUrl(
      new URL(meta.href, pending.currentUrl),
      pending.pendingUrl,
    );
  } catch {
    return false;
  }
}

export function shouldSuspendForPendingNavigation(
  snapshot: NavigationSnapshot,
  options: NavigationPendingOptions = {},
) {
  const pending = snapshot.pending;

  if (!pending) {
    return false;
  }

  const currentUrl = pending.currentUrl;
  const pendingUrl = pending.pendingUrl;

  if (options.when) {
    return options.when({
      currentUrl: cloneUrl(currentUrl),
      pendingUrl: cloneUrl(pendingUrl),
    });
  }

  if (options.watch) {
    return watchedUrlChanged(currentUrl, pendingUrl, options.watch);
  }

  if (options.searchParams) {
    return searchParamsChanged(currentUrl, pendingUrl, options.searchParams);
  }

  return true;
}

/**
 * Suspends while a matching client-side RSC navigation is pending.
 *
 * Use this hook inside a React <Suspense> boundary. When the pending navigation
 * commits to the visible React tree, the thrown promise resolves and React
 * retries the render with the newly committed tree.
 */
export function useNavigationPending(options: NavigationPendingOptions = {}) {
  const snapshot = useSyncExternalStore(
    subscribeNavigationState,
    getNavigationSnapshot,
    getNavigationSnapshot,
  );
  const payloadMeta = useContext(NavigationPayloadMetaContext);

  if (
    shouldSuspendForPendingNavigation(snapshot, options) &&
    !isRenderingMatchingNavigationPayload(snapshot, payloadMeta)
  ) {
    throw snapshot.pending!.promise;
  }

  return snapshot;
}

/**
 * Suspense-aware boundary for client-side RSC navigations.
 *
 * Wrap server-backed UI with this component inside your own <Suspense> fallback
 * to avoid showing stale props while a relevant navigation is in flight.
 */
export function NavigationPending({
  children,
  searchParams,
  watch,
  when,
}: NavigationPendingProps) {
  useNavigationPending({ searchParams, watch, when });

  return <>{children}</>;
}
