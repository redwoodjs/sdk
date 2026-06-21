import type { RequestInfo } from "../../runtime/requestInfo/types";
import { runWithRequestInfo } from "../../runtime/requestInfo/worker";
import {
  SyncedStateServer as HibernationSyncedStateServer,
} from "../hibernation/worker.mjs";
import type { SyncedStateValue } from "../hibernation/protocol.mjs";
import type { SyncedStateIdentity } from "../hibernation/identity.mjs";

export { SyncedStateServer } from "../hibernation/worker.mjs";
export { syncedStateRoutes } from "../hibernation/worker.mjs";

// Backwards-compatible wrapper that preserves the capnweb-style handler API.
//
// The hibernation transport captures requestInfo.ctx at WebSocket upgrade time
// and stores it on the socket attachment. When a legacy handler is invoked,
// we reconstruct a RequestInfo with that captured ctx and run the handler
// inside runWithRequestInfo so existing code can keep reading requestInfo.ctx.

const originalRegisterKeyHandler =
  HibernationSyncedStateServer.registerKeyHandler.bind(
    HibernationSyncedStateServer,
  );
const originalRegisterSetStateHandler =
  HibernationSyncedStateServer.registerSetStateHandler.bind(
    HibernationSyncedStateServer,
  );
const originalRegisterGetStateHandler =
  HibernationSyncedStateServer.registerGetStateHandler.bind(
    HibernationSyncedStateServer,
  );
const originalRegisterSubscribeHandler =
  HibernationSyncedStateServer.registerSubscribeHandler.bind(
    HibernationSyncedStateServer,
  );
const originalRegisterUnsubscribeHandler =
  HibernationSyncedStateServer.registerUnsubscribeHandler.bind(
    HibernationSyncedStateServer,
  );

function makeLegacyRequestInfo(identity: SyncedStateIdentity): RequestInfo {
  return {
    request: new Request("http://internal/use-synced-state"),
    path: "/use-synced-state",
    params: {},
    ctx: identity as any,
    url: new URL("http://internal/use-synced-state"),
    rw: {
      nonce: "",
      Document: () => null,
      rscPayload: false,
      ssr: false,
      databases: new Map(),
      scriptsToBeLoaded: new Set(),
      entryScripts: new Set(),
      inlineScripts: new Set(),
      pageRouteResolved: Promise.withResolvers(),
    },
    cf: {
      waitUntil: () => {},
      passThroughOnException: () => {},
    } as unknown as ExecutionContext,
    response: { headers: new Headers() },
    isAction: false,
  } as unknown as RequestInfo;
}

function callWithLegacyContext<Result>(
  identity: SyncedStateIdentity,
  fn: () => Result,
): Result {
  const requestInfo = makeLegacyRequestInfo(identity);
  return runWithRequestInfo(requestInfo, fn);
}

// Override the static registration methods on the exported class so that the
// public rwsdk/use-synced-state/worker path keeps the old capnweb API while
// internally using the hibernation transport.

// context(justinvdm, 20 Jun 2026): Keep the capnweb handler signatures working
// under the hibernation transport. A handler is treated as legacy when it has
// two parameters and the second is the stub (key, stub) rather than identity.
// We cannot distinguish by arity alone, so we require the new identity-first
// handlers to have exactly three parameters. In practice the only handlers
// that need the shim are the public capnweb-style ones, and the dedicated
// hibernation subpath remains available for the new API.
type DurableObjectStubLike = DurableObjectStub<any>;

function isLegacyKeyHandler(
  handler: Function,
): handler is (key: string, stub: DurableObjectStubLike) => Promise<string> {
  return handler.length === 2;
}

function isLegacySetGetHandler(
  handler: Function,
): handler is (
  key: string,
  value: SyncedStateValue | undefined,
  stub: DurableObjectStubLike,
) => void {
  return handler.length === 3;
}

function isLegacySubscribeUnsubscribeHandler(
  handler: Function,
): handler is (key: string, stub: DurableObjectStubLike) => void {
  return handler.length === 2;
}

(HibernationSyncedStateServer as any).registerKeyHandler = (
  handler: ((key: string, stub: DurableObjectStubLike) => Promise<string>) | null,
) => {
  if (!handler) {
    originalRegisterKeyHandler(null);
    return;
  }
  if (isLegacyKeyHandler(handler)) {
    if (!HibernationSyncedStateServer.getIdentityExtractor()) {
      HibernationSyncedStateServer.registerIdentityExtractor(
        (requestInfo) => requestInfo.ctx,
      );
    }
    originalRegisterKeyHandler(async (key, identity, stub) => {
      return await callWithLegacyContext(identity, () => handler(key, stub));
    });
  } else {
    originalRegisterKeyHandler(handler as any);
  }
};

(HibernationSyncedStateServer as any).registerSetStateHandler = (
  handler:
    | ((
        key: string,
        value: SyncedStateValue,
        stub: DurableObjectStubLike,
      ) => void)
    | null,
) => {
  if (!handler) {
    originalRegisterSetStateHandler(null);
    return;
  }
  if (isLegacySetGetHandler(handler)) {
    if (!HibernationSyncedStateServer.getIdentityExtractor()) {
      HibernationSyncedStateServer.registerIdentityExtractor(
        (requestInfo) => requestInfo.ctx,
      );
    }
    originalRegisterSetStateHandler((key, value, identity, stub) => {
      callWithLegacyContext(identity, () => handler(key, value, stub));
    });
  } else {
    originalRegisterSetStateHandler(handler as any);
  }
};

(HibernationSyncedStateServer as any).registerGetStateHandler = (
  handler:
    | ((
        key: string,
        value: SyncedStateValue | undefined,
        stub: DurableObjectStubLike,
      ) => void)
    | null,
) => {
  if (!handler) {
    originalRegisterGetStateHandler(null);
    return;
  }
  if (isLegacySetGetHandler(handler)) {
    if (!HibernationSyncedStateServer.getIdentityExtractor()) {
      HibernationSyncedStateServer.registerIdentityExtractor(
        (requestInfo) => requestInfo.ctx,
      );
    }
    originalRegisterGetStateHandler((key, value, identity, stub) => {
      callWithLegacyContext(identity, () => handler(key, value, stub));
    });
  } else {
    originalRegisterGetStateHandler(handler as any);
  }
};

(HibernationSyncedStateServer as any).registerSubscribeHandler = (
  handler: ((key: string, stub: DurableObjectStubLike) => void) | null,
) => {
  if (!handler) {
    originalRegisterSubscribeHandler(null);
    return;
  }
  if (isLegacySubscribeUnsubscribeHandler(handler)) {
    if (!HibernationSyncedStateServer.getIdentityExtractor()) {
      HibernationSyncedStateServer.registerIdentityExtractor(
        (requestInfo) => requestInfo.ctx,
      );
    }
    originalRegisterSubscribeHandler((key, identity, stub) => {
      callWithLegacyContext(identity, () => handler(key, stub));
    });
  } else {
    originalRegisterSubscribeHandler(handler as any);
  }
};

(HibernationSyncedStateServer as any).registerUnsubscribeHandler = (
  handler: ((key: string, stub: DurableObjectStubLike) => void) | null,
) => {
  if (!handler) {
    originalRegisterUnsubscribeHandler(null);
    return;
  }
  if (isLegacySubscribeUnsubscribeHandler(handler)) {
    if (!HibernationSyncedStateServer.getIdentityExtractor()) {
      HibernationSyncedStateServer.registerIdentityExtractor(
        (requestInfo) => requestInfo.ctx,
      );
    }
    originalRegisterUnsubscribeHandler((key, identity, stub) => {
      callWithLegacyContext(identity, () => handler(key, stub));
    });
  } else {
    originalRegisterUnsubscribeHandler(handler as any);
  }
};
