import MagicString from "magic-string";
import { type Plugin } from "vite";
import { normalizeModulePath } from "../lib/normalizeModulePath.mjs";

export const injectVitePreamble = ({
  clientEntryPoints,
  projectRootDir,
}: {
  clientEntryPoints: Set<string>;
  projectRootDir: string;
}): Plugin => ({
  name: "rwsdk:inject-vite-preamble",
  apply: "serve",
  transform(code: string, id: string) {

    if (this.environment.name !== "client") {
      return;
    }

    const normalizedId = normalizeModulePath(id, projectRootDir);
    if (!clientEntryPoints.has(normalizedId)) {
      return;
    }

    // Only inject preamble in development mode
    if (process.env.NODE_ENV !== "development") {
      return;
    }

    const s = new MagicString(code);
    s.prepend(`import 'virtual:vite-preamble';\n`);

    return {
      code: s.toString(),
      map: s.generateMap({ hires: true }),
    };
  },
});
