import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  type SyncStateClient,
  setSyncStateClientForTesting,
} from "../client";
import type { SyncStateValue } from "../Coordinator.mjs";
import {
  createSyncStateHook,
  type CreateSyncStateHookOptions,
} from "../useSyncState";

type HookDeps = NonNullable<CreateSyncStateHookOptions["hooks"]>;

const createStateHarness = () => {
  let currentState: SyncStateValue | undefined;
  const cleanups: Array<() => void> = [];

  const useStateImpl: HookDeps["useState"] = ((initialValue?: unknown) => {
    const resolved =
      typeof initialValue === "function"
        ? (initialValue as () => SyncStateValue | undefined)()
        : initialValue;
    currentState = resolved;
    const setState: ReturnType<HookDeps["useState"]>[1] = (next) => {
      currentState =
        typeof next === "function"
          ? (next as (previous: SyncStateValue | undefined) => SyncStateValue)(
              currentState,
            )
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

describe("createSyncStateHook", () => {
  const subscribeHandlers = new Map<
    string,
    (value: SyncStateValue) => void
  >();
  const client: SyncStateClient = {
    async getState() {
      return 5;
    },
    async setState(_value?: SyncStateValue, _key?: string) {},
    async subscribe(key, handler) {
      subscribeHandlers.set(key, handler);
    },
    async unsubscribe(key) {
      subscribeHandlers.delete(key);
    },
  };

  const resetClient = () => {
    client.getState = async () => 5;
    client.setState = async (_value?: SyncStateValue, _key?: string) => {};
    client.subscribe = async (key, handler) => {
      subscribeHandlers.set(key, handler);
    };
    client.unsubscribe = async (key) => {
      subscribeHandlers.delete(key);
    };
  };

  beforeEach(() => {
    resetClient();
    setSyncStateClientForTesting(client);
    subscribeHandlers.clear();
  });

  afterEach(() => {
    setSyncStateClientForTesting(null);
  });

  it("loads remote state and updates local value", async () => {
    const harness = createStateHarness();
    const useSyncState = createSyncStateHook({ hooks: harness.deps });

    const [value] = useSyncState(0, "counter");

    expect(value).toBe(0);
    await Promise.resolve();
    expect(harness.getState()).toBe(5);
  });

  it("sends updates through the client and applies optimistic value", async () => {
    const harness = createStateHarness();
    const setCalls: Array<{ key: string; value: SyncStateValue }> = [];
    client.setState = async (value, key) => {
      setCalls.push({ key, value });
    };

    const useSyncState = createSyncStateHook({ hooks: harness.deps });

    const [, setSyncValue] = useSyncState(0, "counter");
    setSyncValue(9);

    expect(harness.getState()).toBe(9);
    expect(setCalls).toEqual([{ key: "counter", value: 9 }]);
  });

  it("applies remote updates from the subscription handler", async () => {
    const harness = createStateHarness();
    const useSyncState = createSyncStateHook({ hooks: harness.deps });

    useSyncState(0, "counter");
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

    const useSyncState = createSyncStateHook({ hooks: harness.deps });

    useSyncState(0, "counter");
    harness.runCleanups();

    expect(unsubscribed).toEqual([{ key: "counter" }]);
  });
});

