import { type RequestInfo } from "../requestInfo/types";

let manifest: Record<string, any>;

export const getManifest = async (requestInfo: RequestInfo) => {
  if (manifest) {
    return manifest;
  }

  if (import.meta.env.VITE_IS_DEV_SERVER) {
    const url = new URL(requestInfo.request.url);
    console.log(
      "############ in getManifest",
      requestInfo.rw.scriptsToBeLoaded,
    );
    url.searchParams.set(
      "scripts",
      JSON.stringify(Array.from(requestInfo.rw.scriptsToBeLoaded)),
    );
    url.pathname = "/__rwsdk_manifest";
    manifest = await fetch(url.toString()).then((res) => res.json());
  } else {
    const { default: prodManifest } = await import(
      "virtual:rwsdk:manifest.js" as any
    );
    manifest = prodManifest;
  }

  return manifest;
};
