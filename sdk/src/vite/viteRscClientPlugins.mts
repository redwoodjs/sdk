import { vitePluginRscMinimal, type RscPluginOptions } from "@vitejs/plugin-rsc/plugin";
import type { Plugin } from "vite";

export const redwoodViteRscEnvironment = {
  rsc: "worker",
  ssr: "ssr",
  browser: "client",
} as const satisfies NonNullable<RscPluginOptions["environment"]>;

export const disabledPluginRscServerReferencePluginNames = new Set([
  "rsc:use-server",
  "rsc:virtual-vite-rsc/server-references",
  "rsc:encryption-key",
]);

export const requiredPluginRscClientReferencePluginNames = new Set([
  "rsc:minimal",
  "rsc:use-client",
  "rsc:use-client/build-references",
]);

export const pluginRscBasePlugins = ({
  includeServerReferences = false,
}: {
  includeServerReferences?: boolean;
} = {}): Plugin[] => {
  const plugins = vitePluginRscMinimal({
    serverHandler: false,
    customBuildApp: true,
    validateImports: false,
    enableActionEncryption: false,
    environment: redwoodViteRscEnvironment,
  });

  const disabledNames = includeServerReferences
    ? new Set(["rsc:encryption-key"])
    : disabledPluginRscServerReferencePluginNames;

  const filtered = plugins.filter((plugin) => !disabledNames.has(plugin.name));

  const enabledNames = new Set(filtered.map((plugin) => plugin.name));
  for (const requiredName of requiredPluginRscClientReferencePluginNames) {
    if (!enabledNames.has(requiredName)) {
      throw new Error(
        `@vitejs/plugin-rsc did not provide required client-reference plugin ${JSON.stringify(requiredName)}`,
      );
    }
  }

  for (const disabledName of disabledNames) {
    if (enabledNames.has(disabledName)) {
      throw new Error(
        `@vitejs/plugin-rsc server-reference plugin ${JSON.stringify(disabledName)} must not be enabled by default`,
      );
    }
  }

  return filtered;
};
