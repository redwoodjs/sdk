export const HISTORY_STATE_SCROLL_KEY = "__rwsdk_scroll_key";

export type ScrollPosition = {
  x: number;
  y: number;
};

export type PendingScroll = ScrollPosition & {
  behavior: ScrollBehavior;
};

export interface NavigationHistoryState extends Record<string, unknown> {
  path?: string;
  scrollX?: number;
  scrollY?: number;
  [HISTORY_STATE_SCROLL_KEY]?: string;
}

export interface ScrollRestorationController {
  initialize(): void;
  recordCurrentPosition(x: number, y: number): void;
  flushCurrentPositionToHistoryState(x?: number, y?: number): void;
  pushEntry(href: string, url: URL, initialPosition: ScrollPosition): void;
  replaceEntry(href: string, url: URL, initialPosition: ScrollPosition): void;
  restorePopStateScroll(): void;
  setPendingScroll(pendingScroll: PendingScroll): void;
  applyPendingScroll(): void;
}

export function createScrollRestoration(): ScrollRestorationController {
  const historyEntryKeyPrefix = Math.random().toString(36).slice(2);
  const scrollPositions = new Map<string, ScrollPosition>();
  let currentHistoryEntryKey: string | null = null;
  let nextHistoryEntryKey = 0;
  let pendingScroll: PendingScroll | null = null;

  function createHistoryEntryKey() {
    nextHistoryEntryKey += 1;
    return `${historyEntryKeyPrefix}:${nextHistoryEntryKey}`;
  }

  function readHistoryState(): NavigationHistoryState {
    const state = window.history.state;
    return state && typeof state === "object"
      ? ({ ...(state as Record<string, unknown>) } as NavigationHistoryState)
      : {};
  }

  function getHistoryEntryKey(state: NavigationHistoryState) {
    const key = state[HISTORY_STATE_SCROLL_KEY];
    return typeof key === "string" ? key : null;
  }

  function getScrollPositionFromState(state: NavigationHistoryState) {
    if (
      typeof state.scrollX === "number" ||
      typeof state.scrollY === "number"
    ) {
      return {
        x: typeof state.scrollX === "number" ? state.scrollX : 0,
        y: typeof state.scrollY === "number" ? state.scrollY : 0,
      } satisfies ScrollPosition;
    }

    return null;
  }

  function ensureCurrentHistoryEntryKey(state = readHistoryState()) {
    const existingKey = getHistoryEntryKey(state);
    if (existingKey) {
      currentHistoryEntryKey = existingKey;
      return existingKey;
    }

    const historyEntryKey = createHistoryEntryKey();
    currentHistoryEntryKey = historyEntryKey;
    window.history.replaceState(
      { ...state, [HISTORY_STATE_SCROLL_KEY]: historyEntryKey },
      "",
      window.location.href,
    );
    return historyEntryKey;
  }

  function getCurrentHistoryEntryKeyForReplace(state: NavigationHistoryState) {
    const existingKey = getHistoryEntryKey(state) ?? currentHistoryEntryKey;
    if (existingKey) {
      currentHistoryEntryKey = existingKey;
      return existingKey;
    }

    const historyEntryKey = createHistoryEntryKey();
    currentHistoryEntryKey = historyEntryKey;
    return historyEntryKey;
  }

  function getSavedScrollPosition(state: NavigationHistoryState) {
    const historyEntryKey = getHistoryEntryKey(state) ?? currentHistoryEntryKey;
    const savedPosition = historyEntryKey
      ? scrollPositions.get(historyEntryKey)
      : undefined;
    return savedPosition ?? getScrollPositionFromState(state);
  }

  function writeHistoryState(
    state: NavigationHistoryState,
    historyEntryKey: string,
    position: ScrollPosition,
  ) {
    window.history.replaceState(
      {
        ...state,
        [HISTORY_STATE_SCROLL_KEY]: historyEntryKey,
        scrollX: position.x,
        scrollY: position.y,
      } satisfies NavigationHistoryState,
      "",
      window.location.href,
    );
  }

  return {
    initialize() {
      // Take manual control of scroll restoration. With "auto", the browser
      // restores scroll immediately on popstate — before the RSC payload has
      // committed — which causes the old DOM to flash at the new scroll offset.
      if ("scrollRestoration" in window.history) {
        window.history.scrollRestoration = "manual";
      }

      // Boot can happen after a reload, or after an older runtime wrote only
      // scrollX/scrollY. Seed the in-memory store from history.state so the
      // first commit can restore the saved position without per-scroll writes.
      const bootState = readHistoryState();
      const bootHistoryEntryKey = ensureCurrentHistoryEntryKey(bootState);
      const bootScrollPosition = getSavedScrollPosition(bootState);
      if (bootScrollPosition) {
        scrollPositions.set(bootHistoryEntryKey, bootScrollPosition);
        pendingScroll = {
          x: bootScrollPosition.x,
          y: bootScrollPosition.y,
          behavior: "instant",
        };
      }
    },

    recordCurrentPosition(x: number, y: number) {
      if (!currentHistoryEntryKey) {
        return;
      }

      scrollPositions.set(currentHistoryEntryKey, { x, y });
    },

    flushCurrentPositionToHistoryState(x = window.scrollX, y = window.scrollY) {
      const state = readHistoryState();
      const historyEntryKey = ensureCurrentHistoryEntryKey(state);
      const position = { x, y } satisfies ScrollPosition;
      scrollPositions.set(historyEntryKey, position);
      writeHistoryState(state, historyEntryKey, position);
    },

    pushEntry(href: string, url: URL, initialPosition: ScrollPosition) {
      this.flushCurrentPositionToHistoryState();

      const historyEntryKey = createHistoryEntryKey();
      currentHistoryEntryKey = historyEntryKey;
      scrollPositions.set(historyEntryKey, initialPosition);
      window.history.pushState(
        {
          path: href,
          [HISTORY_STATE_SCROLL_KEY]: historyEntryKey,
          scrollX: initialPosition.x,
          scrollY: initialPosition.y,
        } satisfies NavigationHistoryState,
        "",
        url,
      );
    },

    replaceEntry(href: string, url: URL, initialPosition: ScrollPosition) {
      const state = readHistoryState();
      const historyEntryKey = getCurrentHistoryEntryKeyForReplace(state);
      scrollPositions.set(historyEntryKey, initialPosition);
      window.history.replaceState(
        {
          ...state,
          path: href,
          [HISTORY_STATE_SCROLL_KEY]: historyEntryKey,
          scrollX: initialPosition.x,
          scrollY: initialPosition.y,
        } satisfies NavigationHistoryState,
        "",
        url,
      );
    },

    restorePopStateScroll() {
      const state = readHistoryState();
      const historyEntryKey = ensureCurrentHistoryEntryKey(state);
      const savedScrollPosition = getSavedScrollPosition(state) ?? {
        x: 0,
        y: 0,
      };

      if (!scrollPositions.has(historyEntryKey)) {
        scrollPositions.set(historyEntryKey, savedScrollPosition);
      }

      pendingScroll = {
        x: savedScrollPosition.x,
        y: savedScrollPosition.y,
        behavior: "instant",
      };
    },

    setPendingScroll(nextPendingScroll: PendingScroll) {
      pendingScroll = nextPendingScroll;
      this.recordCurrentPosition(nextPendingScroll.x, nextPendingScroll.y);
    },

    applyPendingScroll() {
      if (!pendingScroll) return;

      const { x, y, behavior } = pendingScroll;
      pendingScroll = null;
      window.scrollTo({ top: y, left: x, behavior });
      this.recordCurrentPosition(x, y);
    },
  };
}
