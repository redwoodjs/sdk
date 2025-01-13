import React from "react";

// @ts-ignore
import { __SERVER_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE as internals } from "react";

// @ts-ignore
React.__SERVER_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = internals;

export {
  Children,
  Fragment,
  Profiler,
  StrictMode,
  Suspense,
  cloneElement,
  createElement,
  createRef,
  use,
  forwardRef,
  isValidElement,
  lazy,
  memo,
  cache,
  useId,
  useCallback,
  useDebugValue,
  useMemo,
  version,
  // @ts-ignore
  __SERVER_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE,
} from "react";

// context(justinvdm, 2025-01-09): We share the same runtime env for running react ssr and rsc. So when we see a import for "react",
// we need to stub the react parts that would be reached for SSR that react's RSC bundle doesn't export:
// https://github.com/facebook/react/blob/64f89510af244b1d812de7a74e161975d99ad3e1/packages/react/src/ReactServer.js#L40-L61
export const useState = (value: any) => [value];
export const useEffect = (..._: any[]) => { };

export default React;