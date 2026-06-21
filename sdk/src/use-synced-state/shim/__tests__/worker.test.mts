import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("cloudflare:workers", () => {
  class DurableObject {}
  return { DurableObject };
});

import {
  SyncedStateServer,
} from "../worker.mjs";

// This test verifies that the public rwsdk/use-synced-state/worker path, when
// resolved through the hibernation shim, still accepts capnweb-style handler
// signatures that read requestInfo.ctx.

describe("use-synced-state shim", () => {
  afterEach(() => {
    SyncedStateServer.registerKeyHandler(null);
    SyncedStateServer.registerSetStateHandler(null);
    SyncedStateServer.registerGetStateHandler(null);
    SyncedStateServer.registerSubscribeHandler(null);
    SyncedStateServer.registerUnsubscribeHandler(null);
    SyncedStateServer.registerIdentityExtractor(null);
  });

  it("wraps a legacy key handler so it can read requestInfo.ctx", async () => {
    const keyHandler = vi.fn(async (key: string, _stub: any) => {
      return `${key}:legacy`;
    });

    SyncedStateServer.registerKeyHandler(keyHandler);

    expect(SyncedStateServer.getIdentityExtractor()).not.toBeNull();

    const extractor = SyncedStateServer.getIdentityExtractor()!;
    const identity = await extractor({
      ctx: { userId: "42" },
    } as any);

    expect(identity).toEqual({ userId: "42" });
  });

  it("passes through new-style handlers without identity wrapping", () => {
    const newHandler = vi.fn(async (_key: string, _identity: unknown, _stub: any) => "ok");
    SyncedStateServer.registerKeyHandler(newHandler);
    expect(SyncedStateServer.getIdentityExtractor()).toBeNull();
  });
});
