import { describe, expect, it } from "vitest";
import {
  directiveModulesDevPlugin,
  generateAppBarrelContent,
  generateVendorBarrelContent,
} from "./directiveModulesDevPlugin.mjs";

const makeConfig = () => ({
  command: "serve" as const,
  environments: {
    client: { optimizeDeps: {} as any },
    ssr: { optimizeDeps: {} as any },
    worker: { optimizeDeps: {} as any },
    aux_email_worker: { optimizeDeps: {} as any },
  },
});

describe("directiveModulesDevPlugin", () => {
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

  describe("configResolved", () => {
    it("only injects barrels into SDK environments", () => {
      const plugin = directiveModulesDevPlugin({
        clientFiles: new Set(),
        serverFiles: new Set(),
        projectRootDir,
        workerEntryPathname: "/Users/test/project/src/worker.tsx",
        esbuildOptions: {},
      });

      const config = makeConfig();
      (plugin as any).configResolved(config);

      for (const envName of ["client", "ssr", "worker"]) {
        const env = (config.environments as any)[envName];
        expect(env.optimizeDeps.include).toContain(
          "rwsdk/__vendor_client_barrel",
        );
        expect(env.optimizeDeps.include).toContain(
          "rwsdk/__vendor_server_barrel",
        );
        expect(env.optimizeDeps.entries).toContain(
          "rwsdk/__vendor_client_barrel",
        );
        expect(env.optimizeDeps.entries).toContain(
          "rwsdk/__vendor_server_barrel",
        );
        expect(env.optimizeDeps.rolldownOptions.plugins).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ name: "rwsdk:app-barrel-blocker" }),
          ]),
        );
      }

      const auxEnv = (config.environments as any).aux_email_worker;
      expect(auxEnv.optimizeDeps.include).toBeUndefined();
      expect(auxEnv.optimizeDeps.entries).toBeUndefined();
      expect(auxEnv.optimizeDeps.rolldownOptions?.plugins).toBeUndefined();
    });
  });
});
