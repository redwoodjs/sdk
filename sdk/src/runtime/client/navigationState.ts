export interface NavigationSnapshot {
  /** URL represented by the React tree that has committed to the screen. */
  currentUrl: URL;
  /** The latest client navigation that has updated history but not committed. */
  pending: PendingNavigationSnapshot | null;
}

export interface PendingNavigationSnapshot {
  id: number;
  /** URL represented by the currently visible React tree when navigation began. */
  currentUrl: URL;
  /** URL that the pending RSC navigation is rendering. */
  pendingUrl: URL;
  /** Resolves when this pending navigation commits, is superseded, or is aborted. */
  promise: Promise<void>;
}

interface PendingNavigationInternal extends PendingNavigationSnapshot {
  resolve: () => void;
}

type NavigationListener = () => void;

const listeners = new Set<NavigationListener>();

let nextNavigationId = 0;
let currentUrl = readWindowUrl();
let pendingNavigation: PendingNavigationInternal | null = null;
let snapshot = createSnapshot();

function readWindowUrl() {
  if (typeof window !== "undefined" && window.location?.href) {
    return new URL(window.location.href);
  }

  return new URL("http://localhost/");
}

function cloneUrl(url: URL) {
  return new URL(url.href);
}

function createSnapshot(): NavigationSnapshot {
  return {
    currentUrl: cloneUrl(currentUrl),
    pending: pendingNavigation
      ? {
          id: pendingNavigation.id,
          currentUrl: cloneUrl(pendingNavigation.currentUrl),
          pendingUrl: cloneUrl(pendingNavigation.pendingUrl),
          promise: pendingNavigation.promise,
        }
      : null,
  };
}

function updateSnapshot() {
  snapshot = createSnapshot();
}

function notifyListeners() {
  for (const listener of listeners) {
    listener();
  }
}

function toUrl(url: string | URL) {
  if (url instanceof URL) {
    return cloneUrl(url);
  }

  return new URL(url, readWindowUrl());
}

function toNavigationDocumentHref(url: string | URL) {
  const nextUrl = toUrl(url);
  nextUrl.hash = "";
  return nextUrl.href;
}

export function isSameNavigationDocumentUrl(
  left: string | URL,
  right: string | URL,
) {
  return toNavigationDocumentHref(left) === toNavigationDocumentHref(right);
}

function createDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

export function subscribeNavigationState(listener: NavigationListener) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function getNavigationSnapshot() {
  return snapshot;
}

export function beginPendingNavigation(url: string | URL) {
  const supersededNavigation = pendingNavigation;
  const targetUrl = toUrl(url);
  const { promise, resolve } = createDeferred();

  pendingNavigation = {
    id: ++nextNavigationId,
    currentUrl: cloneUrl(currentUrl),
    pendingUrl: targetUrl,
    promise,
    resolve,
  };

  updateSnapshot();
  notifyListeners();
  supersededNavigation?.resolve();

  return pendingNavigation;
}

export function isPendingNavigationCommit(href?: string | URL) {
  if (!pendingNavigation) {
    return false;
  }

  if (href === undefined) {
    return true;
  }

  return isSameNavigationDocumentUrl(href, pendingNavigation.pendingUrl);
}

export function commitPendingNavigation(href?: string | URL) {
  if (!isPendingNavigationCommit(href)) {
    return false;
  }

  const committedNavigation = pendingNavigation!;
  pendingNavigation = null;
  currentUrl = cloneUrl(committedNavigation.pendingUrl);

  updateSnapshot();
  notifyListeners();
  committedNavigation.resolve();

  return true;
}

export function abortPendingNavigation(id?: number) {
  if (!pendingNavigation) {
    return false;
  }

  if (id !== undefined && pendingNavigation.id !== id) {
    return false;
  }

  const abortedNavigation = pendingNavigation;
  pendingNavigation = null;

  updateSnapshot();
  notifyListeners();
  abortedNavigation.resolve();

  return true;
}

export function resetNavigationStateForTests(href = "http://localhost/") {
  pendingNavigation?.resolve();
  pendingNavigation = null;
  nextNavigationId = 0;
  currentUrl = new URL(href);
  updateSnapshot();
  notifyListeners();
}
