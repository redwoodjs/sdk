import * as ReactRSC from "react"
import { ReactSSR } from "vendor/react-ssr"

import { AsyncLocalStorage } from 'node:async_hooks';

const React = {}

const reactStorage = new AsyncLocalStorage<Map<'runtime', 'rsc' | 'ssr'>>();

// context(justinvdm, 2025-01-21): React's own event loop implementation seems to make us lose AsyncLocalStorage context.
// Accessing a global that gets the store appears to work around this. Inspecting the current context returned by the global 
// as react does work (performWork, retryNode, renderElement) suggests the context is being tracked correctly this way
// but I still need to understand why it works and if it is in fact robust enough a solution
(globalThis as any).__getCurrentReactRuntime = () => reactStorage.getStore()?.get('runtime')

export const getReactProperty = <Name extends BothRuntimeProperties>(name: Name): GetReactProperty<Name> => {
  console.log('## getReactProperty', name, (globalThis as any).__getCurrentReactRuntime())
  const runtime = (globalThis as any).__getCurrentReactRuntime() ?? 'rsc'
  const v = runtime === "rsc" ? (ReactRSC as any)[name] : (ReactSSR as any)[name]
  return v
}

type BothRuntimeProperties = keyof typeof ReactRSC | keyof typeof ReactSSR

type GetReactProperty<Name extends BothRuntimeProperties> =
  Name extends keyof typeof ReactRSC
  ? Name extends keyof typeof ReactSSR
  ? (typeof ReactSSR)[Name] & (typeof ReactRSC)[Name]
  : (typeof ReactRSC)[Name]
  : (typeof ReactSSR)[Name]

for (const key of Array.from(new Set(Object.keys(ReactRSC).concat(Object.keys(ReactSSR))))) {
  Object.defineProperty(React, key, {
    enumerable: true,
    get() {
      return getReactProperty(key as BothRuntimeProperties)
    }
  })
}

const defineObject = <Name extends BothRuntimeProperties>(name: Name): GetReactProperty<Name> => {
  const wrapper = {}

  const keys = new Set(Object.keys((ReactRSC as any)[name] ?? {}).concat(Object.keys((ReactSSR as any)[name] ?? {})))

  for (const key of Array.from(keys)) {
    Object.defineProperty(wrapper, key, {
      enumerable: true,
      configurable: true,
      set(value) {
        (getReactProperty(name) as any)[key] = value
      },
      get() {
        return (getReactProperty(name) as any)[key]
      }
    })
  }

  return wrapper as GetReactProperty<Name>
}

const defineMethod = <Name extends BothRuntimeProperties>(name: Name): GetReactProperty<Name> => (
  (...args: any[]) => (getReactProperty(name) as any)(...args)
) as GetReactProperty<Name>

export const defineExport = <Name extends BothRuntimeProperties>(name: Name): GetReactProperty<Name> => {
  const original = (ReactRSC as any)[name] ?? (ReactSSR as any)[name]
  // @ts-ignore
  if (typeof original === "function") {
    return defineMethod(name)
  }

  if (original != null && typeof original === "object") {
    return defineObject(name)
  }

  return original
}

export const runInReactRuntime = async <Result>(runtime: "rsc" | "ssr", callback: () => Result | Promise<Result>) => {
  const { promise, resolve } = Promise.withResolvers<Result>()
  await reactStorage.run(new Map(), async () => {
    reactStorage.getStore()?.set('runtime', runtime)
    return await Promise.resolve().then(callback).then(resolve)
  });
  return await promise
}
export const getReactRuntime = () => reactStorage.getStore()

export default (React as typeof ReactRSC & typeof ReactSSR)

// @ts-expect-error
export const __SERVER_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = ReactRSC.__SERVER_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
// @ts-expect-error
export const __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = ReactSSR.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
export const Children = defineExport("Children")
export const Component = defineExport("Component")
export const Fragment = defineExport("Fragment")
export const Profiler = defineExport("Profiler")
export const PureComponent = defineExport("PureComponent")
export const StrictMode = defineExport("StrictMode")
export const Suspense = defineExport("Suspense")
export const cloneElement = defineExport("cloneElement")
export const createContext = defineExport("createContext")
export const createElement = defineExport("createElement")
export const createRef = defineExport("createRef")
export const use = defineExport("use")
export const forwardRef = defineExport("forwardRef")
export const isValidElement = defineExport("isValidElement")
export const lazy = defineExport("lazy")
export const memo = defineExport("memo")
export const cache = defineExport("cache")
export const startTransition = defineExport("startTransition")
// @ts-expect-error React doesn't expose type for this property
export const unstable_DebugTracingMode = defineExport("unstable_DebugTracingMode")
// @ts-expect-error React doesn't expose type for this property
export const unstable_LegacyHidden = defineExport("unstable_LegacyHidden")
// @ts-expect-error React doesn't expose type for this property
export const unstable_Activity = defineExport("unstable_Activity")
// @ts-expect-error React doesn't expose type for this property
export const unstable_Scope = defineMethod("unstable_Scope")
export const unstable_SuspenseList = defineMethod("unstable_SuspenseList")
// @ts-expect-error React doesn't expose type for this property
export const unstable_TracingMarker = defineExport("unstable_TracingMarker")
// @ts-expect-error React doesn't expose type for this property
export const unstable_getCacheForType = defineExport("unstable_getCacheForType")
export const unstable_useCacheRefresh = defineExport("unstable_useCacheRefresh")
export const useId = defineExport("useId")
export const useCallback = defineExport("useCallback")
export const useContext = defineExport("useContext")
export const useDebugValue = defineExport("useDebugValue")
export const useDeferredValue = defineExport("useDeferredValue")
export const useEffect = defineExport("useEffect")
export const experimental_useEffectEvent = defineExport("experimental_useEffectEvent")
export const useImperativeHandle = defineExport("useImperativeHandle")
export const useInsertionEffect = defineExport("useInsertionEffect")
export const useLayoutEffect = defineExport("useLayoutEffect")
export const useMemo = defineExport("useMemo")
export const useOptimistic = defineExport("useOptimistic")
export const useSyncExternalStore = defineExport("useSyncExternalStore")
export const useReducer = defineExport("useReducer")
export const useRef = defineExport("useRef")
export const useState = defineExport("useState")
export const useTransition = defineExport("useTransition")
export const useActionState = defineExport("useActionState")
export const version = defineExport("version")
