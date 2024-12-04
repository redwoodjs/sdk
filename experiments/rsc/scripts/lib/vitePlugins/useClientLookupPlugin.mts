import { virtualPlugin } from "./virtualPlugin.mjs";

export const useClientLookupPlugin = ({
  filesContainingUseClient,
}: {
  filesContainingUseClient: string[];
}) =>
  virtualPlugin(
    "use-client-lookup",
    () => `
export const useClientLookup = {
  ${filesContainingUseClient
    .map(
      (file) => `
  "${file}": () => import("${file}"),
`,
    )
    .join("")}
};
`,
  );
