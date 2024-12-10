import { type HotPayload } from "vite";

export type RunnerRpc = {
  initRunner: () => Promise<void>;
  sendToRunner: (payload: HotPayload) => Promise<void>;
};

export type RunnerEnv = {
  __viteRoot: string;
};
