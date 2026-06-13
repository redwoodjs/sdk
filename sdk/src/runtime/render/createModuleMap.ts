import { createModuleMapFromViteRsc } from "./viteRscManifestAdapter.js";
import { getViteRscManifestData } from "./viteRscManifestData.js";

const createFallbackModuleMap = () =>
  new Proxy(
    {},
    {
      get(_, id: string) {
        return new Proxy<ClientManifest>(
          {},
          {
            get(_, name) {
              return {
                id,
                name,
                chunks: [],
                async: true,
              };
            },
          },
        );
      },
    },
  );

export const createModuleMap = () => {
  const viteRscManifestData = getViteRscManifestData();

  if (viteRscManifestData) {
    return createModuleMapFromViteRsc(viteRscManifestData);
  }

  return createFallbackModuleMap();
};
