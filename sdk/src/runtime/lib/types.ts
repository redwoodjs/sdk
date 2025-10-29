import { type Kysely } from "kysely";
import React from "react";
import { type RequestInfo } from "../requestInfo/types.js";

export type RwContext = {
  nonce: string;
  Document: React.FC<DocumentProps<any>>;
  rscPayload: boolean;
  ssr: boolean;
  layouts?: React.FC<LayoutProps<any>>[];
  databases: Map<string, Kysely<any>>;
  scriptsToBeLoaded: Set<string>;
  entryScripts: Set<string>;
  inlineScripts: Set<string>;
  pageRouteResolved: PromiseWithResolvers<void> | undefined;
  actionResult?: unknown;
};

export type DocumentProps<T extends RequestInfo = RequestInfo> = T & {
  children: React.ReactNode;
};

export type LayoutProps<T extends RequestInfo = RequestInfo> = {
  children?: React.ReactNode;
  requestInfo?: T;
};
