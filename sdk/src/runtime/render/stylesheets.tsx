import { getManifest } from "../lib/manifest.js";
import { type RequestInfo } from "../requestInfo/types.js";

// context(justinvdm, 2026-03-15): Vite's client manifest uses keys without
// a leading slash (e.g. "src/app/pages/Welcome.tsx"), but our module IDs in
// scriptsToBeLoaded use Vite-style leading-slash paths (e.g.
// "/src/app/pages/Welcome.tsx") from normalizeModulePath. We strip the
// leading slash here so the lookup succeeds.
const toManifestKey = (id: string) => (id.startsWith("/") ? id.slice(1) : id);

const findCssForModule = (
  scriptId: string,
  manifest: Record<
    string,
    {
      file: string;
      css?: string[];
      imports?: string[];
      dynamicImports?: string[];
    }
  >,
) => {
  const css = new Set<string>();
  const visited = new Set<string>();

  const inner = (id: string) => {
    if (visited.has(id)) {
      return;
    }
    visited.add(id);

    const entry = manifest[toManifestKey(id)];
    if (!entry) {
      return;
    }

    if (entry.css) {
      for (const href of entry.css) {
        css.add(href);
      }
    }

    // context(justinvdm, 2026-04-23): Rolldown associates CSS with the
    // chunk that imports the CSS file, which may be a dynamic import target
    // rather than the entry chunk. Walk both static and dynamic imports to
    // find CSS from transitive dependencies.
    if (entry.imports) {
      for (const importId of entry.imports) {
        inner(importId);
      }
    }
    if (entry.dynamicImports) {
      for (const importId of entry.dynamicImports) {
        inner(importId);
      }
    }
  };

  inner(scriptId);

  return Array.from(css);
};

import { toAbsoluteHref } from "./assetPaths.js";

export const Stylesheets = async ({
  requestInfo,
}: {
  requestInfo: RequestInfo;
}) => {
  const manifest = await getManifest();
  const allStylesheets = new Set<string>();

  for (const scriptId of requestInfo.rw.scriptsToBeLoaded) {
    const css = findCssForModule(scriptId, manifest);
    for (const entry of css) {
      allStylesheets.add(toAbsoluteHref(entry));
    }
  }

  for (const [, entry] of Object.entries(manifest)) {
    if ((entry as { isEntry?: boolean }).isEntry) {
      const css = findCssForModule(
        (entry as { src?: string }).src ?? "",
        manifest,
      );
      for (const href of css) {
        allStylesheets.add(toAbsoluteHref(href));
      }
    }
  }

  return (
    <>
      {Array.from(allStylesheets).map((href) => (
        <link key={href} rel="stylesheet" href={href} precedence="first" />
      ))}
    </>
  );
};
