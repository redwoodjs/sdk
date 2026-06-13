import type { ViteRscClientReferenceMetaMap } from "./viteRscManifestAdapter.js";

export type ViteRscManifestData = {
  clientReferenceMetaMap: ViteRscClientReferenceMetaMap;
  projectRootDir?: string;
};

const globalManifestData = () =>
  (globalThis as typeof globalThis & {
    __RWSDK_VITE_RSC_MANIFEST_DATA__?: ViteRscManifestData;
  }).__RWSDK_VITE_RSC_MANIFEST_DATA__;

export const getViteRscManifestData = () => {
  const data = globalManifestData();

  if (!data || Object.keys(data.clientReferenceMetaMap ?? {}).length === 0) {
    return undefined;
  }

  return data;
};
