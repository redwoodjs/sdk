import "./types/ssr";

import type {
  NavigationPendingOptions,
  NavigationPendingProps,
} from "../client/navigationPending.js";
import type { NavigationSnapshot } from "../client/navigationState.js";

export * from "../lib/streams/consumeEventStream";

export const navigate = () => {
  /* stub */
};

export function useNavigationPending(
  _options: NavigationPendingOptions = {},
): NavigationSnapshot {
  return {
    currentUrl: new URL("http://localhost/"),
    pending: null,
  };
}

export function NavigationPending({ children }: NavigationPendingProps) {
  return children ?? null;
}
