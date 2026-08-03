import { FC } from "react";
import { type DocumentProps } from "../lib/types";
import { generateNonce } from "../lib/utils";
import { type PartialRequestInfo, type RequestInfo } from "./types";

export const DefaultRequestInfoDocument: FC<DocumentProps> = ({ children }) => (
  <>{children}</>
);

/**
 * Constructs a generic requestInfo that can be used as defaults.
 * Allows for passing in overrides to initialize with defaults.
 */
export const constructWithDefaultRequestInfo = (
  overrides: PartialRequestInfo = {},
): RequestInfo => {
  const { rw: rwOverrides, ...otherRequestInfoOverrides } = overrides;

  const defaultRequestInfo: RequestInfo = {
    request: new Request("http://localhost/"),
    path: "/",
    params: {},
    ctx: {},
    // context(justinvdm, 2026-07-31): @cloudflare/workers-types v5 made
    // `exports` and `tracing` required on ExecutionContext. This default
    // requestInfo is a placeholder for non-Worker contexts (its waitUntil
    // and passThroughOnException were already no-op stubs), so we keep the
    // same stub shape and cast rather than fabricate tracing machinery the
    // placeholder would never exercise.
    cf: {
      waitUntil: () => {},
      passThroughOnException: () => {},
      props: {},
    } as unknown as ExecutionContext,
    response: {
      status: 200,
      headers: new Headers(),
    },
    isAction: false,
    rw: {
      Document: DefaultRequestInfoDocument,
      nonce: generateNonce(),
      rscPayload: true,
      ssr: true,
      databases: new Map(),
      scriptsToBeLoaded: new Set(),
      entryScripts: new Set(),
      inlineScripts: new Set(),
      pageRouteResolved: undefined,
    },
  };

  return {
    ...defaultRequestInfo,
    ...otherRequestInfoOverrides,
    rw: {
      ...defaultRequestInfo.rw,
      ...rwOverrides,
    },
  };
};
