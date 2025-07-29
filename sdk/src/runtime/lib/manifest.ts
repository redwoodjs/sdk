let manifest: Record<string, any>;

export const getManifest = async (scriptsToBeLoaded?: Set<string>) => {
  if (manifest) {
    return manifest;
  }

  if (import.meta.env.VITE_IS_DEV_SERVER) {
    const scripts = Array.from(scriptsToBeLoaded || []);
    const params = new URLSearchParams({ scripts: JSON.stringify(scripts) });
    const res = await fetch(`/__rwsdk_manifest?${params.toString()}`);
    manifest = await res.json();
  } else {
    const { default: prodManifest } = await import(
      "virtual:manifest.js" as any
    );
    manifest = prodManifest;
  }

  return manifest;
};
