import { describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "os";
import path from "path";
import {
  generateAppBarrelContent,
  generateVendorBarrelContent,
} from "./directiveModulesDevPlugin.mjs";

describe("directiveModulesDevPlugin helpers", () => {
  const projectRootDir = "/Users/test/project";

  describe("generateVendorBarrelContent", () => {
    it("should generate correct content for vendor files", () => {
      const files = new Set([
        "/node_modules/lib-a/index.js",
        "src/app.js",
        "/node_modules/lib-b/component.tsx",
      ]);
      const content = generateVendorBarrelContent(files, projectRootDir);
      const expected = `import * as M0 from '/node_modules/lib-a/index.js';
import * as M1 from '/node_modules/lib-b/component.tsx';

export default {
  '/node_modules/lib-a/index.js': M0,
  '/node_modules/lib-b/component.tsx': M1,
};`;
      expect(content).toEqual(expected);
    });

    it("should return empty content if no vendor files", () => {
      const files = new Set(["src/app.js", "src/component.tsx"]);
      const content = generateVendorBarrelContent(files, projectRootDir);
      expect(content).toEqual("\n\nexport default {\n\n};");
    });

    it("should handle an empty file set", () => {
      const files = new Set<string>();
      const content = generateVendorBarrelContent(files, projectRootDir);
      expect(content).toEqual("\n\nexport default {\n\n};");
    });
  });

  describe("generateAppBarrelContent", () => {
    it("should generate correct content for app files", () => {
      const files = new Set([
        "src/app.js",
        "node_modules/lib-a/index.js",
        "src/component.tsx",
      ]);
      const content = generateAppBarrelContent(files, projectRootDir);
      const expected = `import "${projectRootDir}/src/app.js";
import "${projectRootDir}/src/component.tsx";`;
      expect(content).toEqual(expected);
    });

    it("should return empty content if no app files", () => {
      const files = new Set([
        "node_modules/lib-a/index.js",
        "node_modules/lib-b/component.tsx",
      ]);
      const content = generateAppBarrelContent(files, projectRootDir);
      expect(content).toEqual("");
    });

    it("should handle an empty file set", () => {
      const files = new Set<string>();
      const content = generateAppBarrelContent(files, projectRootDir);
      expect(content).toEqual("");
    });
  });

  describe("barrel module loading integration", () => {
    it("should allow named exports to be accessed via the barrel's default export", async () => {
      // Create a temp directory to simulate node_modules structure
      const tempDir = mkdtempSync(path.join(os.tmpdir(), "barrel-test-"));
      const nodeModulesDir = path.join(tempDir, "node_modules");
      const libADir = path.join(nodeModulesDir, "lib-a");
      const libBDir = path.join(nodeModulesDir, "lib-b");

      mkdirSync(libADir, { recursive: true });
      mkdirSync(libBDir, { recursive: true });

      // Create mock module files
      writeFileSync(path.join(libADir, "index.js"), "export const componentA = 'A';\nexport const utilA = 'util-a';");
      writeFileSync(path.join(libBDir, "component.js"), "export const componentB = 'B';\nexport const utilB = 'util-b';");

      // Use the actual Vite-style paths that the barrel generator would produce
      const files = new Set([
        "/node_modules/lib-a/index.js",
        "/node_modules/lib-b/component.js",
      ]);

      const barrelContent = generateVendorBarrelContent(files, tempDir);

      // Verify barrel content has aligned import and export key paths (Vite-style)
      // Both import and export should use the same path format for each file
      expect(barrelContent).toContain("from '/node_modules/lib-a/index.js'");
      expect(barrelContent).toContain("'/node_modules/lib-a/index.js': M0");

      expect(barrelContent).toContain("from '/node_modules/lib-b/component.js'");
      expect(barrelContent).toContain("'/node_modules/lib-b/component.js': M1");

      // For module loading, we need relative paths. Generate a loadable version
      // by replacing the Vite-style paths with relative paths to our temp dir.
      const loadableBarrelContent = barrelContent
        .replace(/from '\/node_modules\/lib-a\/index.js'/g, "from './node_modules/lib-a/index.js'")
        .replace(/from '\/node_modules\/lib-b\/component.js'/g, "from './node_modules/lib-b/component.js'");

      // Write loadable barrel to temp dir
      const barrelPath = path.join(tempDir, "barrel.js");
      writeFileSync(barrelPath, loadableBarrelContent);

      // Load the barrel as a module and verify exports are accessible
      const barrelModule = await import(barrelPath);

      // Access exports via the barrel's default export object
      const exports = barrelModule.default;

      // Verify both modules are accessible under their Vite-style path keys
      // The keys in the barrel's default export use Vite-style paths
      expect(exports["/node_modules/lib-a/index.js"]).toBeDefined();
      expect(exports["/node_modules/lib-b/component.js"]).toBeDefined();

      // Verify the module contents are correct
      const libAExports = exports["/node_modules/lib-a/index.js"];
      const libBExports = exports["/node_modules/lib-b/component.js"];

      expect(libAExports.componentA).toBe("A");
      expect(libAExports.utilA).toBe("util-a");
      expect(libBExports.componentB).toBe("B");
      expect(libBExports.utilB).toBe("util-b");

      // Cleanup
      rmSync(tempDir, { recursive: true, force: true });
    });
  });
});
