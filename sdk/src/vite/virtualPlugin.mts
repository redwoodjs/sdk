import { Plugin } from "vite";

// port(justinvdm, 3 Dec 2024): From https://github.com/hi-ogawa/vite-environment-examples/blob/440212b4208fc66a14d69a1bcbc7c5254b7daa91/examples/react-server/src/features/utils/plugin.ts#L37
export const virtualPlugin = (name: string, load: Plugin["load"]): Plugin => {
  name = "virtual:" + name;
  return {
    name: `rwsdk:virtual-${name}`,
    resolveId(source, _importer, options?: { custom?: any }) {
      // Skip during our directive scanning to avoid performance issues
      // context(justinvdm, 20 Jan 2025): We check options.custom?.rwsdk?.directiveScan to distinguish
      // between our directive scan (which should skip) and external calls like Cloudflare's early
      // dispatch (which should be handled normally).
      if (options?.custom?.rwsdk?.directiveScan === true) {
        return;
      }

      if (source === name || source.startsWith(`${name}?`)) {
        return `\0${source}`;
      }
      return;
    },
    load(id, options) {

      if (id === `\0${name}` || id.startsWith(`\0${name}?`)) {
        return (load as any).apply(this, [id, options]);
      }
    },
  };
};
