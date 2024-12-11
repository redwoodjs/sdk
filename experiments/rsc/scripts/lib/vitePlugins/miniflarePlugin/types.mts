import { type HotPayload } from "vite";

export type RunnerRpc = {
  initRunner: () => Promise<void>;
  sendToRunner: (payload: HotPayload) => Promise<void>;
};

export type RunnerEnv = {
  __viteRoot: string;
  __viteInvoke: {
    fetch: (request: Request) => Promise<Response>;
  };
  __viteSendToServer: {
    fetch: (request: Request) => Promise<Response>;
  };
};

export type FetchMetadata = {
  entry: string;
};
