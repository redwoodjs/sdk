import { describe, expect, it } from "vitest";
import {
  RECOVERY_NAVIGATION_LIMIT,
  RECOVERY_NAVIGATION_STORAGE_KEY,
  RECOVERY_NAVIGATION_WINDOW_MS,
  consumeRecoveryNavigationBudget,
} from "./recovery.js";

type RecoveryStorage = Pick<Storage, "getItem" | "setItem">;

function createStorage(initialValue: string | null = null): {
  storage: RecoveryStorage;
  read(): string | null;
} {
  let value = initialValue;

  return {
    storage: {
      getItem(key) {
        expect(key).toBe(RECOVERY_NAVIGATION_STORAGE_KEY);
        return value;
      },
      setItem(key, nextValue) {
        expect(key).toBe(RECOVERY_NAVIGATION_STORAGE_KEY);
        value = nextValue;
      },
    },
    read: () => value,
  };
}

describe("consumeRecoveryNavigationBudget", () => {
  it("permits and records requests below the limit", () => {
    const { storage, read } = createStorage();
    const timestamps = [1_000, 2_000, 3_000];

    for (const now of timestamps) {
      expect(consumeRecoveryNavigationBudget({ storage, now })).toBe(true);
    }

    expect(JSON.parse(read() ?? "null")).toEqual(timestamps);
    expect(timestamps).toHaveLength(RECOVERY_NAVIGATION_LIMIT);
  });

  it("declines the next request inside the rolling window", () => {
    const { storage, read } = createStorage(
      JSON.stringify([1_000, 2_000, 3_000]),
    );

    expect(consumeRecoveryNavigationBudget({ storage, now: 3_001 })).toBe(
      false,
    );
    expect(JSON.parse(read() ?? "null")).toEqual([1_000, 2_000, 3_000]);
  });

  it("removes timestamps at the window boundary before permitting a request", () => {
    const { storage, read } = createStorage(JSON.stringify([0, 1_000, 2_000]));

    expect(
      consumeRecoveryNavigationBudget({
        storage,
        now: RECOVERY_NAVIGATION_WINDOW_MS,
      }),
    ).toBe(true);
    expect(JSON.parse(read() ?? "null")).toEqual([
      1_000,
      2_000,
      RECOVERY_NAVIGATION_WINDOW_MS,
    ]);
  });

  it("replaces malformed data with a valid timestamp list", () => {
    const { storage, read } = createStorage("not json");

    expect(consumeRecoveryNavigationBudget({ storage, now: 4_000 })).toBe(true);
    expect(JSON.parse(read() ?? "null")).toEqual([4_000]);
  });

  it("removes non-numeric entries and keeps the stored list bounded", () => {
    const { storage, read } = createStorage(
      JSON.stringify([1, "2", null, 2, 3, 4]),
    );

    expect(consumeRecoveryNavigationBudget({ storage, now: 5 })).toBe(false);
    expect(JSON.parse(read() ?? "null")).toEqual([2, 3, 4]);
  });

  it.each([
    [
      "read",
      {
        getItem() {
          throw new Error("storage unavailable");
        },
        setItem() {},
      },
    ],
    [
      "write",
      {
        getItem() {
          return null;
        },
        setItem() {
          throw new Error("storage unavailable");
        },
      },
    ],
  ] satisfies Array<[string, RecoveryStorage]>)(
    "declines navigation when storage %s fails",
    (_operation, storage) => {
      expect(consumeRecoveryNavigationBudget({ storage, now: 1_000 })).toBe(
        false,
      );
    },
  );
});
