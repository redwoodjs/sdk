import { React } from "../runtime/client/client.js";
import { getSyncedStateClient } from "./client-core.js";
import { DEFAULT_SYNCED_STATE_PATH } from "./constants.mjs";

type HookDeps = {
  useState: typeof React.useState;
  useEffect: typeof React.useEffect;
  useRef: typeof React.useRef;
  useCallback: typeof React.useCallback;
};

const defaultDeps: HookDeps = {
  useState: React.useState,
  useEffect: React.useEffect,
  useRef: React.useRef,
  useCallback: React.useCallback,
};

type Setter<T> = (value: T | ((previous: T) => T)) => void;

export type CreateSyncedStateHookOptions = {
  url?: string;
  hooks?: HookDeps;
};

/**
 * Builds a `useSyncedState` hook configured with optional endpoint and hook overrides.
 * @param options Optional overrides for endpoint and React primitives.
 * @returns Hook that syncs state through the sync state service.
 */
export const createSyncedStateHook = (
  options: CreateSyncedStateHookOptions = {},
) => {
  const resolvedUrl = options.url ?? DEFAULT_SYNCED_STATE_PATH;
  const deps = options.hooks ?? defaultDeps;
  const { useState, useEffect, useRef, useCallback } = deps;

  return function useSyncedState<T>(
    initialValue: T,
    key: string,
  ): [T, Setter<T>] {
    if (typeof window === "undefined" && !options.hooks) {
      return [initialValue, () => {}];
    }

    const client = getSyncedStateClient(resolvedUrl);
    const [value, setValue] = useState(initialValue);
    const valueRef = useRef(value);
    valueRef.current = value;

    const setSyncValue = useCallback<Setter<T>>(
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

    return [value, setSyncValue];
  };
};

export const useSyncedState = createSyncedStateHook();
