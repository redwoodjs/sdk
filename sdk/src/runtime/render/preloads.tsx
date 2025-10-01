import type { Manifest, ManifestChunk } from "../lib/manifest.js";
import { getManifest } from "../lib/manifest.js";
import type { RequestInfo } from "../requestInfo/types.js";

export function findScriptForModule(
  id: string,
  manifest: Manifest,
): ManifestChunk | undefined {
  const visited = new Set();
  function find(id: string): ManifestChunk | undefined {
    if (visited.has(id)) {
      return;
    }
    visited.add(id);
    const manifestEntry = manifest[id];

    if (!manifestEntry) {
      return;
    }

    if (manifestEntry.isEntry || manifestEntry.isDynamicEntry) {
      return manifestEntry;
    }

    if (manifestEntry.imports) {
      for (const dep of manifestEntry.imports) {
        const entry = find(dep);
        if (entry) {
          return entry;
        }
      }
    }

    return;
  }
  return find(id);
}

export const Preloads = async ({
  requestInfo,
}: {
  requestInfo: RequestInfo;
}) => {
  const manifest = await getManifest();
  const allScripts = new Set<string>();

  for (const scriptId of requestInfo.rw.scriptsToBeLoaded) {
    const script = findScriptForModule(scriptId, manifest);
    if (script) {
      allScripts.add(script.file);
    }
  }

  return (
    <>
      {Array.from(allScripts).map((href) => (
        <link key={href} rel="modulepreload" href={href} />
      ))}
    </>
  );
};
