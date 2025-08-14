import { use } from "react";
import type { RequestInfo } from "../requestInfo/types.js";
import { getManifest } from "../lib/manifest.js";
import type { Manifest, ManifestChunk } from "../lib/manifest.js";

function findCssForModule(
  id: string,
  manifest: Manifest,
): ReadonlyArray<string> {
  const visited = new Set();
  const css = new Set<string>();
  function find(id: string) {
    if (visited.has(id)) {
      return;
    }
    visited.add(id);
    const manifestEntry = manifest[id];
    if (!manifestEntry) {
      return;
    }
    if (manifestEntry.css) {
      for (const dep of manifestEntry.css) {
        css.add(dep);
      }
    }
    if (manifestEntry.imports) {
      for (const dep of manifestEntry.imports) {
        find(dep);
      }
    }
  }
  find(id);
  return Array.from(css);
}

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

    if (manifestEntry.isEntry) {
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

export const Stylesheets = ({ requestInfo }: { requestInfo: RequestInfo }) => {
  const manifest = use(getManifest(requestInfo));
  const allStylesheets = new Set<string>();

  for (const scriptId of requestInfo.rw.scriptsToBeLoaded) {
    const css = findCssForModule(scriptId, manifest);
    for (const entry of css) {
      allStylesheets.add(entry);
    }
  }

  return (
    <>
      {Array.from(allStylesheets).map((href) => (
        <link key={href} rel="stylesheet" href={href} precedence="first" />
      ))}
      {Array.from(allStylesheets).map((href) => (
        <link key={href} rel="preload" as="style" href={href} />
      ))}
    </>
  );
};

export const Preloads = ({ requestInfo }: { requestInfo: RequestInfo }) => {
  const manifest = use(getManifest(requestInfo));
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
