import ReactRSC from "react"
import { ReactSSR } from "vendor/react-ssr"

let __CURRENT_REACT_RUNTIME: "rsc" | "ssr" = "rsc"

const React = {}

type BothRuntimeProperties = keyof typeof ReactRSC | keyof typeof ReactSSR

type GetReactProperty<Name extends BothRuntimeProperties> =
  Name extends keyof typeof ReactRSC
  ? Name extends keyof typeof ReactSSR
  ? (typeof ReactSSR)[Name] & (typeof ReactRSC)[Name]
  : (typeof ReactRSC)[Name]
  : (typeof ReactSSR)[Name]

for (const key of Array.from(new Set(Object.keys(ReactRSC).concat(Object.keys(ReactSSR))))) {
  Object.defineProperty(React, key, {
    get() {
      return __CURRENT_REACT_RUNTIME === "rsc" ? (ReactRSC as any)[key] : (ReactSSR as any)[key]
    }
  })
}

const defineObject = <Name extends BothRuntimeProperties>(name: Name): GetReactProperty<Name> => {
  const wrapper = {}

  const keys = new Set(Object.keys((ReactRSC as any)[name] ?? {}).concat(Object.keys((ReactSSR as any)[name] ?? {})))

  for (const key of Array.from(keys)) {
    Object.defineProperty(wrapper, key, {
      get() {
        return __CURRENT_REACT_RUNTIME === "rsc" ? (ReactRSC as any)[name][key] : (ReactSSR as any)[name][key]
      }
    })
  }

  return wrapper as GetReactProperty<Name>
}

const defineMethod = <Name extends BothRuntimeProperties>(name: Name): GetReactProperty<Name> => ((...args: any[]) => {
  console.log('#################### method call', __CURRENT_REACT_RUNTIME, name, args)
  return __CURRENT_REACT_RUNTIME === "rsc" ? (ReactRSC as any)[name](...args) : (ReactSSR as any)[name](...args)
}) as GetReactProperty<Name>

export const __switchReactRuntime = (runtime: "rsc" | "ssr") => {
  console.log('#################### switchReactRuntime', runtime)
  __CURRENT_REACT_RUNTIME = runtime
}

export default (React as typeof ReactRSC & typeof ReactSSR)
export const Children = defineObject("Children")
export const Component = defineObject("Component")
export const Fragment = defineObject("Fragment")
export const Profiler = defineObject("Profiler")
export const PureComponent = defineObject("PureComponent")
export const StrictMode = defineObject("StrictMode")
export const Suspense = defineObject("Suspense")
export const cloneElement = defineMethod("cloneElement")
export const createContext = defineMethod("createContext")
export const createElement = defineMethod("createElement")
export const createRef = defineMethod("createRef")
export const use = defineMethod("use")
export const forwardRef = defineMethod("forwardRef")
export const isValidElement = defineMethod("isValidElement")
export const lazy = defineMethod("lazy")
export const memo = defineMethod("memo")
export const cache = defineMethod("cache")
export const startTransition = defineMethod("startTransition")
// @ts-expect-error React doesn't expose type for this property
export const unstable_DebugTracingMode = defineMethod("unstable_DebugTracingMode")
// @ts-expect-error React doesn't expose type for this property
export const unstable_LegacyHidden = defineMethod("unstable_LegacyHidden")
// @ts-expect-error React doesn't expose type for this property
export const unstable_Activity = defineMethod("unstable_Activity")
// @ts-expect-error React doesn't expose type for this property
export const unstable_Scope = defineMethod("unstable_Scope")
export const unstable_SuspenseList = defineMethod("unstable_SuspenseList")
// @ts-expect-error React doesn't expose type for this property
export const unstable_TracingMarker = defineMethod("unstable_TracingMarker")
// @ts-expect-error React doesn't expose type for this property
export const unstable_getCacheForType = defineMethod("unstable_getCacheForType")
export const unstable_useCacheRefresh = defineMethod("unstable_useCacheRefresh")
export const useId = defineMethod("useId")
export const useCallback = defineMethod("useCallback")
export const useContext = defineMethod("useContext")
export const useDebugValue = defineMethod("useDebugValue")
export const useDeferredValue = defineMethod("useDeferredValue")
export const useEffect = defineMethod("useEffect")
export const experimental_useEffectEvent = defineMethod("experimental_useEffectEvent")
export const useImperativeHandle = defineMethod("useImperativeHandle")
export const useInsertionEffect = defineMethod("useInsertionEffect")
export const useLayoutEffect = defineMethod("useLayoutEffect")
export const useMemo = defineMethod("useMemo")
export const useOptimistic = defineMethod("useOptimistic")
export const useSyncExternalStore = defineMethod("useSyncExternalStore")
export const useReducer = defineMethod("useReducer")
export const useRef = defineMethod("useRef")
export const useState = defineMethod("useState")
export const useTransition = defineMethod("useTransition")
export const useActionState = defineMethod("useActionState")
export const version = ReactRSC.version