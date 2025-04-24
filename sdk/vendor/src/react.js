import ImportedReact from "react";
import { __SERVER_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE as IMPORTED_SERVER_INTERNALS } from "react-server-internals";

import { __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE as IMPORTED_CLIENT_INTERNALS } from "react";

// context(justinvdm, 2025-02-10): Vite dev server reloads as it discovers new deps during its dep optimization passes.
// When it does this, react and react-dom are re-instantiated. However, miniflare sandbox will have the old instances around.
// If react is re-instantiated after react-dom, then react-dom will get a different instance of the react internals object than
// the one the new react is working off of.
// * This is a problem for normal (SSR) React - new react module will not have its internal state set up correctly since
// react-dom didn't interact with it
//   => we need to hold onto the old instance, and export _it_ instead of the React instance, along with the old client internals
// * On the other hand, for RSC react, it doesn't want to see that there was an inexisting renderer around before it was instantiated
//   => we need to export the new instance of the server internals

// context(justinvdm, 2025-04-18): This file is now built in both development and production modes
// The customReactBuildPlugin will use the appropriate build based on the Vite mode.
// In development mode, we include extra logging and validation.

if (typeof globalThis.__REACT === "undefined") {
  globalThis.__REACT = {
    ...ImportedReact,
    __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE:
      IMPORTED_CLIENT_INTERNALS,
  };
}

const React = globalThis.__REACT;
React.__SERVER_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE =
  IMPORTED_SERVER_INTERNALS;

const {
  Children,
  createRef,
  Component,
  PureComponent,
  createContext,
  forwardRef,
  lazy,
  memo,
  cache,
  unstable_postpone,
  useCallback,
  unstable_useContextWithBailout,
  useContext,
  useEffect,
  experimental_useEffectEvent,
  experimental_useResourceEffect,
  useImperativeHandle,
  useDebugValue,
  useInsertionEffect,
  useLayoutEffect,
  useMemo,
  useOptimistic,
  useActionState,
  useSyncExternalStore,
  useReducer,
  useRef,
  useState,
  Fragment,
  Profiler,
  StrictMode,
  unstable_DebugTracingMode,
  Suspense,
  createElement,
  cloneElement,
  isValidElement,
  version,
  __COMPILER_RUNTIME,
  __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE,
  __SERVER_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE,
  useTransition,
  startTransition,
  useDeferredValue,
  unstable_SuspenseList,
  unstable_LegacyHidden,
  unstable_Activity,
  unstable_getCacheForType,
  unstable_useCacheRefresh,
  use,
  unstable_Scope,
  unstable_TracingMarker,
  useId,
  act,
  captureOwnerStack,
} = React;

export {
  Children,
  createRef,
  Component,
  PureComponent,
  createContext,
  forwardRef,
  lazy,
  memo,
  cache,
  unstable_postpone,
  useCallback,
  unstable_useContextWithBailout,
  useContext,
  useEffect,
  experimental_useEffectEvent,
  experimental_useResourceEffect,
  useImperativeHandle,
  useDebugValue,
  useInsertionEffect,
  useLayoutEffect,
  useMemo,
  useOptimistic,
  useActionState,
  useSyncExternalStore,
  useReducer,
  useRef,
  useState,
  Fragment,
  Profiler,
  StrictMode,
  unstable_DebugTracingMode,
  Suspense,
  createElement,
  cloneElement,
  isValidElement,
  version,
  __COMPILER_RUNTIME,
  __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE,
  __SERVER_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE,
  useTransition,
  startTransition,
  useDeferredValue,
  unstable_SuspenseList,
  unstable_LegacyHidden,
  unstable_Activity,
  unstable_getCacheForType,
  unstable_useCacheRefresh,
  use,
  unstable_Scope,
  unstable_TracingMarker,
  useId,
  act,
  captureOwnerStack,
};

export default React;
