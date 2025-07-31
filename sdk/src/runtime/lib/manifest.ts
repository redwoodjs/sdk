import { type RequestInfo } from "../requestInfo/types";

declare const __RWS_MANIFEST_PLACEHOLDER__: string;

let manifest: Record<string, any>;

export const getManifest = async (requestInfo: RequestInfo) => {
  if (manifest) {
    return manifest;
  }

  if (import.meta.env.VITE_IS_DEV_SERVER) {
    const url = new URL(requestInfo.request.url);
    url.searchParams.set(
      "scripts",
      JSON.stringify(Array.from(requestInfo.rw.scriptsToBeLoaded)),
    );
    url.pathname = "/__rwsdk_manifest";
    manifest = await fetch(url.toString()).then((res) => res.json());
  } else {
    manifest = JSON.parse("__RWS_MANIFEST_PLACEHOLDER__");
  }

  return manifest;
};
