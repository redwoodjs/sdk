import {
  useCallback as reactUseCallback,
  useEffect as reactUseEffect,
  useRef as reactUseRef,
  useState as reactUseState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { getSyncedStateClient } from "./client";

type UseStateLike = <T>(
  initialValue: T | (() => T),
) => [T, Dispatch<SetStateAction<T>>];

type HookDeps = {
  useEffect: typeof reactUseEffect;
  useRef: typeof reactUseRef;
  useCallback: typeof reactUseCallback;
};

const defaultDeps: HookDeps = {
  useEffect: reactUseEffect,
  useRef: reactUseRef,
  useCallback: reactUseCallback,
};

type Setter<T> = (value: T | ((previous: T) => T)) => void;

export const createSyncedStateHook = (
  useStateImpl: UseStateLike,
  deps: HookDeps = defaultDeps,
) => {
  const { useEffect, useRef, useCallback } = deps;

  return function useSyncedState<T>(
    initialValue: T,
    key: string,
  ): [T, Setter<T>] {
    if (typeof window === "undefined") {
      return [initialValue, () => {}];
    }

    const client = getSyncedStateClient();
    const [value, setValue] = useStateImpl(initialValue);
    const valueRef = useRef(value);
    valueRef.current = value;

    const setSyncedValue = useCallback<Setter<T>>(
      (nextValue) => {
        const resolved =
          typeof nextValue === "function"
            ? (nextValue as (previous: T) => T)(valueRef.current)
            : nextValue;
        setValue(resolved);
        valueRef.current = resolved;
        void client.setState(resolved, key);
      },
      [client, key, setValue, valueRef],
    );

    useEffect(() => {
      let isActive = true;
      const handleUpdate = (next: unknown) => {
        if (isActive) {
          setValue(next as T);
          valueRef.current = next as T;
        }
      };

      void client.getState(key).then((existing) => {
        if (existing !== undefined && isActive) {
          setValue(existing as T);
          valueRef.current = existing as T;
        }
      });

      void client.subscribe(key, handleUpdate);

      return () => {
        isActive = false;
        void client.unsubscribe(key, handleUpdate);
      };
    }, [client, key, setValue, valueRef]);

    return [value, setSyncedValue];
  };
};

export const useSyncedState = createSyncedStateHook(reactUseState);
