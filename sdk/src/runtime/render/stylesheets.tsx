import { getManifest } from "../lib/manifest.js";
import { type RequestInfo } from "../requestInfo/types.js";

const findCssForModule = (
  scriptId: string,
  manifest: Record<string, { file: string; css?: string[] }>,
) => {
  const css = new Set<string>();
  const visited = new Set<string>();

  const inner = (id: string) => {
    if (visited.has(id)) {
      return;
    }
    visited.add(id);

    const entry = manifest[id];
    if (!entry) {
      return;
    }

    if (entry.css) {
      for (const href of entry.css) {
        css.add(href);
      }
    }
  };

  inner(scriptId);

  return Array.from(css);
};

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
      allStylesheets.add(entry);
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
