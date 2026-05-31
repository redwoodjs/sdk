import { describe, expect, it } from "vitest";
import {
  isVirtualSsrModuleId,
  normalizeVirtualSsrModuleId,
  VIRTUAL_SSR_PREFIX,
} from "./ssrVirtualModule.mjs";
import { transformJsxScriptTagsPlugin } from "./transformJsxScriptTagsPlugin.mjs";

describe("isVirtualSsrModuleId", () => {
  it.each([
    [`${VIRTUAL_SSR_PREFIX}/src/Preview.tsx`, true],
    [`${VIRTUAL_SSR_PREFIX}rwsdk/__ssr_bridge`, true],
    [`/@id/${VIRTUAL_SSR_PREFIX}/src/Preview.tsx`, true],
    [`/src/${VIRTUAL_SSR_PREFIX}Preview.tsx`, false],
    ["/src/Preview.tsx", false],
  ])("identifies %s as virtual SSR module id: %s", (id, expected) => {
    expect(isVirtualSsrModuleId(id)).toBe(expected);
  });

  it("normalizes Vite /@id/ virtual SSR module URLs to bare module ids", () => {
    expect(
      normalizeVirtualSsrModuleId(`/@id/${VIRTUAL_SSR_PREFIX}/src/Preview.tsx`),
    ).toBe(`${VIRTUAL_SSR_PREFIX}/src/Preview.tsx`);
  });
});

describe("transformJsxScriptTagsPlugin transform hook", () => {
  function createPlugin() {
    const clientEntryPoints = new Set<string>();
    const plugin = transformJsxScriptTagsPlugin({
      clientEntryPoints,
      projectRootDir: "/project/root/dir",
    });

    const configResolved = plugin.configResolved;
    if (typeof configResolved === "function") {
      configResolved.call({} as any, { command: "serve", base: "/" } as any);
    } else {
      configResolved?.handler.call(
        {} as any,
        { command: "serve", base: "/" } as any,
      );
    }

    const transform =
      typeof plugin.transform === "function"
        ? plugin.transform
        : plugin.transform?.handler;

    if (!transform) {
      throw new Error("Expected transform hook to be defined");
    }

    return { clientEntryPoints, transform: transform as any };
  }

  it.each([
    `${VIRTUAL_SSR_PREFIX}/src/Preview.tsx`,
    `/@id/${VIRTUAL_SSR_PREFIX}/src/Preview.tsx`,
  ])("skips virtual SSR bridge module ids in worker: %s", async (id) => {
    // Regression for #1210: virtual SSR bridge modules have .tsx ids but are
    // already transformed by the ssr environment, so the worker transform must
    // not run script-tag discovery on them again.
    const { clientEntryPoints, transform } = createPlugin();
    const ssrBridgeCode = `
      import { jsx } from "react/jsx-runtime";
      const __vite_ssr_import_0__ = await __vite_ssr_import__("react/jsx-runtime", { importedNames: ["jsx"] });
      export function Preview() {
        return jsx("script", { async: true, src: "https://example.com/a.js" });
      }
    `;

    const result = await transform.call(
      { environment: { name: "worker" } } as any,
      ssrBridgeCode,
      id,
    );

    expect(result).toBeNull();
    expect(clientEntryPoints.size).toBe(0);
  });

  it("still transforms non-bridge worker .tsx modules", async () => {
    const { transform } = createPlugin();
    const code = `
      import { jsx } from "react/jsx-runtime";
      export function Preview() {
        return jsx("script", { async: true, src: "https://example.com/a.js" });
      }
    `;

    const result = await transform.call(
      { environment: { name: "worker" } } as any,
      code,
      "/src/Preview.tsx",
    );

    expect(result).toBeTruthy();
    expect(
      typeof result === "object" && result !== null && "code" in result
        ? result.code
        : "",
    ).toContain("nonce: requestInfo.rw.nonce");
  });
});
