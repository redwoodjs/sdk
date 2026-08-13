import { setTimeout as delay } from "node:timers/promises";
import { describe, expect, it, vi } from "vitest";
import { loadClientModule } from "./loadClientModule.js";

async function getPromiseState(promise: Promise<unknown>) {
  return Promise.race([
    promise.then(
      () => "resolved",
      () => "rejected",
    ),
    delay(10, "pending"),
  ]);
}

describe("loadClientModule", () => {
  it("preserves the lookup error when recovery is not configured", async () => {
    const id = "/src/app/pages/Missing.tsx";

    await expect(
      loadClientModule({
        id,
        moduleFn: undefined,
        recoveryConfigured: () => false,
      }),
    ).rejects.toThrow(
      `(client) No module found for '${id}' in module lookup for "use client" directive`,
    );
  });

  it("suspends a lookup miss while recovery is configured", async () => {
    const pending = new Promise<never>(() => {});
    const suspend = vi.fn(() => pending);

    const result = loadClientModule({
      id: "/src/app/pages/NewComponent.tsx",
      moduleFn: undefined,
      recoveryConfigured: () => true,
      suspend,
    });

    expect(suspend).toHaveBeenCalledWith("module-not-found");
    expect(await getPromiseState(result)).toBe("pending");
  });

  it("suspends a failed dynamic import while recovery is configured", async () => {
    const pending = new Promise<never>(() => {});
    const suspend = vi.fn(() => pending);

    const result = loadClientModule({
      id: "/src/app/pages/ChangedComponent.tsx",
      moduleFn: async () => {
        throw new TypeError("Failed to fetch dynamically imported module");
      },
      recoveryConfigured: () => true,
      suspend,
    });

    await Promise.resolve();
    expect(suspend).toHaveBeenCalledWith("module-not-found");
    expect(await getPromiseState(result)).toBe("pending");
  });

  it("rethrows other module errors", async () => {
    const error = new Error("Application module failed");

    await expect(
      loadClientModule({
        id: "/src/app/pages/BrokenComponent.tsx",
        moduleFn: async () => {
          throw error;
        },
        recoveryConfigured: () => true,
        suspend: vi.fn(),
      }),
    ).rejects.toBe(error);
  });
});
