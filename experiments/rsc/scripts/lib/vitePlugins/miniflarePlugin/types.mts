import { type HotPayload } from "vite";

export type RunnerRpc = {
  initRunner: () => Promise<void>;
  sendToRunner: (payload: HotPayload) => Promise<void>;
};

export type ServiceBindings = {
  __viteInvoke: (request: Request) => Promise<Response>;
  __viteSendToServer: (request: Request) => Promise<Response>;
};

export type EnvServiceBindings = Record<
  keyof ServiceBindings,
  { fetch: (request: Request) => Promise<Response> }
>;

export type RunnerEnv = {
  __viteRoot: string;
  __viteUnsafeEval: {
    eval: (code: string, filename?: string) => any;
  };
} & EnvServiceBindings;

export type FetchMetadata = {
  entry: string;
};

export type NoOptionals<T> = {
  [K in keyof T]-?: T[K];
};

export type RunnerWorkerApi = Fetcher & RunnerRpc;
