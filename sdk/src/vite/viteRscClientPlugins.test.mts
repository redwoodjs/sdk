import { describe, expect, it } from "vitest";
import {
  disabledPluginRscServerReferencePluginNames,
  requiredPluginRscClientReferencePluginNames,
  redwoodViteRscEnvironment,
  pluginRscBasePlugins,
} from "./viteRscClientPlugins.mjs";

describe("pluginRscBasePlugins", () => {
  it("uses Redwood's Vite environment names for plugin-rsc", () => {
    expect(redwoodViteRscEnvironment).toEqual({
      rsc: "worker",
      ssr: "ssr",
      browser: "client",
    });
  });

  it("includes plugin-rsc client-reference plugins and excludes native server-reference plugins by default", () => {
    const plugins = pluginRscBasePlugins();
    const names = new Set(plugins.map((plugin) => plugin.name));

    for (const requiredName of requiredPluginRscClientReferencePluginNames) {
      expect(names.has(requiredName)).toBe(true);
    }

    for (const disabledName of disabledPluginRscServerReferencePluginNames) {
      expect(names.has(disabledName)).toBe(false);
    }
  });

  it("can opt into plugin-rsc server references while keeping action encryption disabled", () => {
    const plugins = pluginRscBasePlugins({
      includeServerReferences: true,
    });
    const names = new Set(plugins.map((plugin) => plugin.name));

    expect(names.has("rsc:use-server")).toBe(true);
    expect(names.has("rsc:virtual-vite-rsc/server-references")).toBe(true);
    expect(names.has("rsc:encryption-key")).toBe(false);
  });
});
