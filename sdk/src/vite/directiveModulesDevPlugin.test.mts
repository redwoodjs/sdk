import { describe, expect, it } from "vitest";
import {
  generateAppBarrelContent,
  generateVendorBarrelContent,
} from "./directiveModulesDevPlugin.mjs";

describe("directiveModulesDevPlugin helpers", () => {
  const projectRootDir = "/Users/test/project";

  describe("generateVendorBarrelContent", () => {
    it("should generate correct content for vendor files", () => {
      const files = new Set([
        "node_modules/lib-a/index.js",
        "src/app.js",
        "node_modules/lib-b/component.tsx",
      ]);
      const content = generateVendorBarrelContent(files, projectRootDir);
      const expected = `import * as M0 from '${projectRootDir}/node_modules/lib-a/index.js';
import * as M1 from '${projectRootDir}/node_modules/lib-b/component.tsx';

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

    it("should exclude files under optimizeDeps.exclude roots", () => {
      const files = new Set([
        "node_modules/lib-a/index.js",
        "node_modules/lib-b/component.tsx",
      ]);
      const excludedRoots = [`${projectRootDir}/node_modules/lib-a`];
      const content = generateVendorBarrelContent(
        files,
        projectRootDir,
        excludedRoots,
      );
      const expected = `import * as M0 from '${projectRootDir}/node_modules/lib-b/component.tsx';

export default {
  '/node_modules/lib-b/component.tsx': M0,
};`;
      expect(content).toEqual(expected);
      expect(content).not.toContain("lib-a");
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

    it("should include excluded node_modules files in the app barrel", () => {
      const files = new Set([
        "src/app.js",
        "node_modules/lib-a/index.js",
        "src/component.tsx",
      ]);
      const excludedRoots = [`${projectRootDir}/node_modules/lib-a`];
      const content = generateAppBarrelContent(
        files,
        projectRootDir,
        excludedRoots,
      );
      const expected = `import "${projectRootDir}/src/app.js";
import "${projectRootDir}/node_modules/lib-a/index.js";
import "${projectRootDir}/src/component.tsx";`;
      expect(content).toEqual(expected);
    });

    it("should include excluded Vite-style /node_modules files in the app barrel", () => {
      const files = new Set([
        "/src/app.js",
        "/node_modules/lib-a/index.js",
        "/src/component.tsx",
      ]);
      const excludedRoots = [`${projectRootDir}/node_modules/lib-a`];
      const content = generateAppBarrelContent(
        files,
        projectRootDir,
        excludedRoots,
      );
      const expected = `import "${projectRootDir}/src/app.js";
import "${projectRootDir}/node_modules/lib-a/index.js";
import "${projectRootDir}/src/component.tsx";`;
      expect(content).toEqual(expected);
    });

    it("should keep transitive node_modules files in the vendor barrel unless they are also excluded", () => {
      const files = new Set([
        "/node_modules/lib-a/index.js",
        "/node_modules/lib-a-utils/index.js",
      ]);
      const excludedRoots = [`${projectRootDir}/node_modules/lib-a`];

      const vendorContent = generateVendorBarrelContent(
        files,
        projectRootDir,
        excludedRoots,
      );
      expect(vendorContent).toContain("lib-a-utils");
      expect(vendorContent).not.toContain("lib-a/index");

      const appContent = generateAppBarrelContent(
        files,
        projectRootDir,
        excludedRoots,
      );
      expect(appContent).toContain("lib-a/index");
      expect(appContent).not.toContain("lib-a-utils");
    });
  });
});
