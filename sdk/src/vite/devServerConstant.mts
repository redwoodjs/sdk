import { Plugin } from "vite";

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      VITE_IS_DEV_SERVER: string;
    }
  }
}

export const devServerConstantPlugin = (): Plugin => {
  return {
    name: "rwsdk:dev-server-constant",
    config(_, { command, isPreview }) {
      if (command === "serve" && isPreview) {
        // context(justinvdm, 21 Jul 2025): Vite forwards this as `import.meta.env.DEV_IS_DEV_SERVER`
        process.env.VITE_IS_DEV_SERVER = "1";
      }
    },
  };
};
