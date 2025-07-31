import { use } from "react";
import { type RequestInfo } from "../requestInfo/types.js";
import { getManifest } from "../lib/manifest.js";

export type CssEntry = {
  url: string;
  content: string;
  absolutePath: string;
};

const findCssForModule = (
  scriptId: string,
  manifest: Record<string, { file: string; css?: (string | CssEntry)[] }>,
) => {
  const css = new Set<string | CssEntry>();
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

export const Stylesheets = ({ requestInfo }: { requestInfo: RequestInfo }) => {
  const manifest = use(getManifest(requestInfo));
  const allStylesheets = new Set<string | CssEntry>();

  for (const scriptId of requestInfo.rw.scriptsToBeLoaded) {
    const css = findCssForModule(scriptId, manifest.client);
    for (const entry of css) {
      allStylesheets.add(entry);
    }
  }

  if (manifest.rsc?.css) {
    for (const entry of manifest.rsc.css) {
      allStylesheets.add(entry);
    }
  }

  return (
    <>
      {Array.from(allStylesheets).map((entry) => {
        if (typeof entry === "string") {
          return (
            <link
              key={entry}
              rel="stylesheet"
              href={entry}
              precedence="first"
            />
          );
        }

        if (import.meta.env.VITE_IS_DEV_SERVER) {
          return (
            <style
              data-vite-dev-id={entry.absolutePath}
              dangerouslySetInnerHTML={{ __html: entry.content }}
              key={entry.url}
            />
          );
        } else {
          return (
            <link
              key={entry.url}
              rel="stylesheet"
              href={entry.url}
              precedence="first"
            />
          );
        }
      })}
    </>
  );
};
