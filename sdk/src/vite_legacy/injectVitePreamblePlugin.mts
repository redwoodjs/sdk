import { type Plugin } from "vite";
import MagicString from "magic-string";

export const injectVitePreamble = ({
  clientEntryPathname,
  mode,
}: {
  clientEntryPathname: string;
  mode: "development" | "production";
}): Plugin => ({
  name: "rwsdk:inject-vite-preamble",
  apply: "serve",
  transform(code: string, id: string) {
    if (id !== clientEntryPathname) {
      return;
    }

    // Only inject preamble in development mode
    if (mode !== "development") {
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
