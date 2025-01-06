import MagicString from "magic-string";
import { virtualPlugin } from "./virtualPlugin.mjs";

export const useClientLookupPlugin = ({
  filesContainingUseClient,
}: {
  filesContainingUseClient: string[];
}) =>
  virtualPlugin("use-client-lookup", () => {
    const s = new MagicString(`
export const useClientLookup = {
  ${filesContainingUseClient
    .map(
      (file) => `
  "${file}": () => import("${file}"),
`,
    )
    .join("")}
};
`);
    return {
      code: s.toString(),
      map: s.generateMap(),
    };
  });
