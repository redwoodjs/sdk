import { describe, expect, it } from "vitest";
import { viteRscRuntimeBridgePlugin } from "./viteRscRuntimeBridgePlugin.mjs";

describe("viteRscRuntimeBridgePlugin", () => {
  it("resolves plugin-rsc's RSC runtime imports to an SDK ESM bridge", async () => {
    const plugin = viteRscRuntimeBridgePlugin();
    const resolveId = plugin.resolveId as any;

    expect(resolveId.call({}, "@vitejs/plugin-rsc/react/rsc")).toBe(
      "\0rwsdk:vite-rsc-runtime-bridge",
    );
    expect(
      resolveId.call(
        {},
        "/repo/node_modules/@vitejs/plugin-rsc/dist/react/rsc.js",
      ),
    ).toBe("\0rwsdk:vite-rsc-runtime-bridge");
    expect(resolveId.call({}, "react")).toBeNull();
  });

  it("loads an ESM server.edge bridge and fails loudly for disabled plugin-rsc server actions", () => {
    const plugin = viteRscRuntimeBridgePlugin();
    const load = plugin.load as any;
    const code = load.call({}, "\0rwsdk:vite-rsc-runtime-bridge");

    expect(code).toContain("react-server-dom-webpack/server.edge");
    expect(code).toContain("registerClientReference");
    expect(code).toContain("$$isClientReference");
    expect(code).toContain("registerServerReference");
    expect(code).toContain("reference.method = action.method");
    expect(code).toContain("reference.source = action.source");
    expect(code).toContain("__rw_server_function");
    expect(code).toContain("plugin-rsc loadServerAction is disabled");
  });
});
