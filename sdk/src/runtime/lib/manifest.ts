let manifest: Record<string, any>;

export const getManifest = async () => {
  if (manifest) {
    return manifest;
  }

  if (import.meta.env.VITE_IS_DEV_SERVER) {
    const res = await fetch("/.vite/manifest.json");
    manifest = await res.json();
  } else {
    const { default: prodManifest } = await import(
      "virtual:manifest.js" as any
    );
    manifest = prodManifest;
  }

  return manifest;
};
