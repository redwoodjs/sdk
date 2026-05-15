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

export async function getManifest() {
  if (manifest) {
    return manifest;
  }

  if (import.meta.env.VITE_IS_DEV_SERVER) {
    // In dev, there's no manifest, so we can use an empty object.
    manifest = {};
  } else {
    // context(justinvdm, 2 Oct 2025): In production, the manifest is a
    // placeholder string that will be replaced by the linker plugin with the
    // actual manifest JSON object.
    manifest = "__RWSDK_MANIFEST_PLACEHOLDER__" as any;
  }

  return manifest;
}
