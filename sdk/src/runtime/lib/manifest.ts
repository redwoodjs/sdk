export type Manifest = Record<string, ManifestChunk>;

export interface ManifestChunk {
  file: string;
  src?: string;
  isEntry?: boolean;
  isDynamicEntry?: boolean;
  imports?: string[];
  css?: string[];
  assets?: string[];
}

let manifest: Manifest;

export const getManifest = async () => {
  if (manifest) {
    return manifest;
  }

  if (import.meta.env.VITE_IS_DEV_SERVER) {
    manifest = {};
  } else {
    const { default: prodManifest } = await import(
      "virtual:rwsdk:manifest.js" as any
    );
    manifest = prodManifest;
  }

  return manifest;
};
