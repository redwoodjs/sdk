import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  setSyncedStateClientForTesting,
  type SyncedStateClient,
} from "../client";
import type { SyncedStateValue } from "../SyncedStateServer.mjs";
import {
  createSyncedStateHook,
  type CreateSyncedStateHookOptions,
} from "../useSyncedState";

type HookDeps = NonNullable<CreateSyncedStateHookOptions["hooks"]>;

const createStateHarness = () => {
  let currentState: SyncedStateValue | undefined;
  const cleanups: Array<() => void> = [];

  const useStateImpl: HookDeps["useState"] = ((initialValue?: unknown) => {
    const resolved =
      typeof initialValue === "function"
        ? (initialValue as () => SyncedStateValue | undefined)()
        : initialValue;
    currentState = resolved;
    const setState: ReturnType<HookDeps["useState"]>[1] = (next) => {
      currentState =
        typeof next === "function"
          ? (
              next as (
                previous: SyncedStateValue | undefined,
              ) => SyncedStateValue
            )(currentState)
          : next;
    };
    return [currentState, setState];
  }) as HookDeps["useState"];

  const useEffectImpl: HookDeps["useEffect"] = (callback) => {
    const cleanup = callback();
    if (typeof cleanup === "function") {
      cleanups.push(cleanup);
    }
  };

  const useRefImpl: HookDeps["useRef"] = ((value: unknown) => ({
    current: value,
  })) as HookDeps["useRef"];

  const useCallbackImpl: HookDeps["useCallback"] = (fn) => fn;

  const deps: HookDeps = {
    useState: useStateImpl,
    useEffect: useEffectImpl,
    useRef: useRefImpl,
    useCallback: useCallbackImpl,
  };

  return {
    deps,
    getState: () => currentState,
    runCleanups: () => cleanups.forEach((fn) => fn()),
  };
};

describe("createSyncedStateHook", () => {
  const subscribeHandlers = new Map<
    string,
    (value: SyncedStateValue) => void
  >();
  const client: SyncedStateClient = {
    async getState() {
      return 5;
    },
    async setState(_value?: SyncedStateValue, _key?: string) {},
    async subscribe(key, handler) {
      subscribeHandlers.set(key, handler);
    },
    async unsubscribe(key) {
      subscribeHandlers.delete(key);
    },
  };

  const resetClient = () => {
    client.getState = async () => 5;
    client.setState = async (_value?: SyncedStateValue, _key?: string) => {};
    client.subscribe = async (key, handler) => {
      subscribeHandlers.set(key, handler);
    };
    client.unsubscribe = async (key) => {
      subscribeHandlers.delete(key);
    };
  };

  beforeEach(() => {
    resetClient();
    setSyncedStateClientForTesting(client);
    subscribeHandlers.clear();
  });

  afterEach(() => {
    setSyncedStateClientForTesting(null);
  });

  it("loads remote state and updates local value", async () => {
    const harness = createStateHarness();
    const useSyncedState = createSyncedStateHook({ hooks: harness.deps });

    const [value] = useSyncedState(0, "counter");

    expect(value).toBe(0);
    await Promise.resolve();
    expect(harness.getState()).toBe(5);
  });

  it("sends updates through the client and applies optimistic value", async () => {
    const harness = createStateHarness();
    const setCalls: Array<{ key: string; value: SyncedStateValue }> = [];
    client.setState = async (value, key) => {
      setCalls.push({ key, value });
    };

    const useSyncedState = createSyncedStateHook({ hooks: harness.deps });

    const [, setSyncValue] = useSyncedState(0, "counter");
    setSyncValue(9);

    expect(harness.getState()).toBe(9);
    expect(setCalls).toEqual([{ key: "counter", value: 9 }]);
  });

  it("applies remote updates from the subscription handler", async () => {
    const harness = createStateHarness();
    const useSyncedState = createSyncedStateHook({ hooks: harness.deps });

    useSyncedState(0, "counter");
    await Promise.resolve();

    const handler = subscribeHandlers.get("counter");
    handler?.(7);

    expect(harness.getState()).toBe(7);
  });

  it("unsubscribes during cleanup", () => {
    const harness = createStateHarness();
    const unsubscribed: Array<{ key: string }> = [];
    client.unsubscribe = async (key) => {
      unsubscribed.push({ key });
      subscribeHandlers.delete(key);
    };

    const useSyncedState = createSyncedStateHook({ hooks: harness.deps });

    useSyncedState(0, "counter");
    harness.runCleanups();

    expect(unsubscribed).toEqual([{ key: "counter" }]);
  });
});
