import type { Manifest, ManifestChunk } from "../lib/manifest.js";
import { getManifest } from "../lib/manifest.js";
import type { RequestInfo } from "../requestInfo/types.js";

// context(justinvdm, 2026-03-15): See toManifestKey in stylesheets.tsx for
// why we strip the leading slash.
const toManifestKey = (id: string) => (id.startsWith("/") ? id.slice(1) : id);

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
    const manifestEntry = manifest[toManifestKey(id)];

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

import { toAbsoluteHref } from "./assetPaths.js";

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
      allScripts.add(toAbsoluteHref(script.file));
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
