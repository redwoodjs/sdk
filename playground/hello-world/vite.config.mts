import { defineConfig } from "vite";
import { redwood } from "rwsdk/vite";

const useLegacyClientReferences =
  process.env.RWSDK_LEGACY_RSC_CLIENT_REFERENCES === "1" ||
  process.env.RWSDK_EXPERIMENTAL_VITE_RSC_CLIENT_REFERENCES === "0";

const disableManifestAdapter =
  process.env.RWSDK_EXPERIMENTAL_VITE_RSC_MANIFEST_ADAPTER === "0";

export default defineConfig({
  plugins: [
    redwood({
      experimentalUseViteRscClientReferences: useLegacyClientReferences
        ? false
        : undefined,
      experimentalUseViteRscManifestAdapter: disableManifestAdapter
        ? false
        : undefined,
      experimentalViteRscServerReferences:
        process.env.RWSDK_EXPERIMENTAL_VITE_RSC_SERVER_REFERENCES === "1",
      includeCloudflarePlugin: true,
    }),
  ],
});
