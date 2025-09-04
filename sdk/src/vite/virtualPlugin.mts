import { Plugin } from "vite";

// port(justinvdm, 3 Dec 2024): From https://github.com/hi-ogawa/vite-environment-examples/blob/440212b4208fc66a14d69a1bcbc7c5254b7daa91/examples/react-server/src/features/utils/plugin.ts#L37
export const virtualPlugin = (name: string, load: Plugin["load"]): Plugin => {
  name = "virtual:" + name;
  return {
    name: `rwsdk:virtual-${name}`,
    resolveId(source, _importer, _options) {
      // Skip during directive scanning to avoid performance issues
      if (process.env.RWSDK_DIRECTIVE_SCAN_ACTIVE) {
        return;
      }
      
      if (source === name || source.startsWith(`${name}?`)) {
        return `\0${source}`;
      }
      return;
    },
    load(id, options) {
      // Skip during directive scanning to avoid performance issues
      if (process.env.RWSDK_DIRECTIVE_SCAN_ACTIVE) {
        return;
      }
      
      if (id === `\0${name}` || id.startsWith(`\0${name}?`)) {
        return (load as any).apply(this, [id, options]);
      }
    },
  };
};
