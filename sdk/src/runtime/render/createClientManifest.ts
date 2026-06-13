import { getViteRscManifestData } from "./viteRscManifestData.js";
import { createClientManifestFromViteRsc } from "./viteRscManifestAdapter.js";

const createFallbackClientManifest = () =>
  new Proxy<ClientManifest>(
    {},
    {
      get(_, key) {
        if (typeof key === "string") {
          const hashIndex = key.lastIndexOf("#");
          if (hashIndex !== -1) {
            return {
              id: key.slice(0, hashIndex),
              name: key.slice(hashIndex + 1),
              chunks: [],
              async: true,
            };
          }
        }

        return { id: key, name: key, chunks: [], async: true };
      },
    },
  );

export const createClientManifest = () => {
  const viteRscManifestData = getViteRscManifestData();

  if (viteRscManifestData) {
    return createClientManifestFromViteRsc(viteRscManifestData);
  }

  return createFallbackClientManifest();
};
