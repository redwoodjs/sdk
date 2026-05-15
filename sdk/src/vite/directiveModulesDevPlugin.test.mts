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
});
