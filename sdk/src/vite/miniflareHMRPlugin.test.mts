import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getImportSignature,
  hasEntryAsAncestor,
  miniflareHMRPlugin,
} from "./miniflareHMRPlugin.mjs";

vi.mock("./runDirectivesScan.mjs", () => ({
  runDirectivesScan: vi.fn(),
}));

vi.mock("./invalidateModule.mjs", () => ({
  invalidateModule: vi.fn(),
}));

vi.mock("./barrelPaths.mjs", () => ({
  getVendorClientBarrelPath: vi.fn(() => undefined),
  getVendorServerBarrelPath: vi.fn(() => undefined),
}));

import { runDirectivesScan } from "./runDirectivesScan.mjs";

interface MockModule {
  file: string;
  importers: Set<MockModule>;
}

const createModule = (file: string): MockModule => ({
  file,
  importers: new Set(),
});

const createMockServer = ({
  rootDir,
  environment,
  file,
}: {
  rootDir: string;
  environment: string;
  file: string;
}) => {
  const workerModule = { file, id: file, url: file, importedModules: new Set() };
  const moduleGraph = {
    getModulesByFile: (f: string) => (f === file ? new Set([workerModule]) : undefined),
    idToModuleMap: new Map([[file, workerModule]]),
    urlToModuleMap: new Map([[file, workerModule]]),
  };

  return {
    config: { root: rootDir },
    environments: {
      [environment]: { moduleGraph, hot: { send: vi.fn() } },
      client: { moduleGraph: { getModulesByFile: () => undefined }, hot: { send: vi.fn() } },
      ssr: { moduleGraph: { getModulesByFile: () => undefined } },
    },
    hot: { send: vi.fn() },
  };
};

const callHotUpdate = async (
  plugin: any,
  ctx: {
    file: string;
    server: any;
    modules?: any[];
  },
) => {
  const hotUpdate = plugin.hotUpdate;
  return hotUpdate.call(
    {
      environment: {
        name: "worker",
        logger: { info: vi.fn() },
      },
    },
    ctx,
  );
};

describe("hasEntryAsAncestor", () => {
  it("should return true if the entry file is a direct importer", () => {
    const entry = createModule("entry.js");
    const mod = createModule("mod.js");
    mod.importers.add(entry);

    expect(hasEntryAsAncestor({ module: mod, entryFile: "entry.js" })).toBe(
      true,
    );
  });

  it("should return true if the entry file is an indirect importer", () => {
    const entry = createModule("entry.js");
    const importer1 = createModule("importer1.js");
    const mod = createModule("mod.js");

    importer1.importers.add(entry);
    mod.importers.add(importer1);

    expect(hasEntryAsAncestor({ module: mod, entryFile: "entry.js" })).toBe(
      true,
    );
  });

  it("should return false if the entry file is not an importer", () => {
    const entry = createModule("entry.js");
    const other = createModule("other.js");
    const mod = createModule("mod.js");

    mod.importers.add(other);

    expect(hasEntryAsAncestor({ module: mod, entryFile: "entry.js" })).toBe(
      false,
    );
  });

  it("should handle circular dependencies", () => {
    const entry = createModule("entry.js");
    const modA = createModule("modA.js");
    const modB = createModule("modB.js");

    modA.importers.add(entry);
    modA.importers.add(modB);
    modB.importers.add(modA);

    expect(hasEntryAsAncestor({ module: modB, entryFile: "entry.js" })).toBe(
      true,
    );
  });

  it("should return false for a module with no importers", () => {
    const mod = createModule("mod.js");
    expect(hasEntryAsAncestor({ module: mod, entryFile: "entry.js" })).toBe(
      false,
    );
  });
});

describe("getImportSignature", () => {
  it("returns an empty string when the file has no imports", () => {
    const code = `export const foo = 1;`;
    expect(getImportSignature("file.ts", code)).toBe("");
  });

  it("returns a sorted, newline-joined list of import specifiers", () => {
    const code = `
      import { a } from "./b";
      import c from "./a";
    `;
    expect(getImportSignature("file.ts", code)).toBe("./a\n./b");
  });

  it("is stable regardless of import order", () => {
    const codeA = `
      import { a } from "./a";
      import { b } from "./b";
    `;
    const codeB = `
      import { b } from "./b";
      import { a } from "./a";
    `;
    expect(getImportSignature("file.ts", codeA)).toBe(
      getImportSignature("file.ts", codeB),
    );
  });

  it("changes when a specifier changes", () => {
    const before = `import { a } from "./a";`;
    const after = `import { a } from "./b";`;
    expect(getImportSignature("file.ts", before)).not.toBe(
      getImportSignature("file.ts", after),
    );
  });

  it("does not change when only imported names change", () => {
    const before = `import { a } from "./mod";`;
    const after = `import { b } from "./mod";`;
    expect(getImportSignature("file.ts", before)).toBe(
      getImportSignature("file.ts", after),
    );
  });

  it("includes dynamic imports and require calls", () => {
    const code = `
      const a = import("./dynamic");
      const b = require("./commonjs");
    `;
    const signature = getImportSignature("file.ts", code);
    expect(signature).toContain("./commonjs");
    expect(signature).toContain("./dynamic");
  });

  it("ignores commented-out imports", () => {
    const code = `
      // import { a } from "./ignored";
      import { b } from "./kept";
    `;
    expect(getImportSignature("file.ts", code)).toBe("./kept");
  });

  it("handles multi-line imports and re-exports", () => {
    const code = `
      import {
        a,
        b,
      } from "./multi";
      export { c } from "./reexport";
    `;
    const signature = getImportSignature("file.ts", code);
    expect(signature).toContain("./multi");
    expect(signature).toContain("./reexport");
  });
});

describe("miniflareHMRPlugin hotUpdate gating", () => {
  let tmpDir: string;
  let workerFile: string;
  let plugins: any;
  let plugin: any;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "rwsdk-hmr-test-"));
    workerFile = join(tmpDir, "worker.ts");
    plugins = miniflareHMRPlugin({
      clientFiles: new Set(),
      serverFiles: new Set(),
      rootDir: tmpDir,
      viteEnvironment: { name: "worker" },
      workerEntryPathname: "/src/worker.ts",
    });
    plugin = plugins.find((p: any) => p.hotUpdate);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("runs runDirectivesScan on the first HMR update to a worker file", async () => {
    writeFileSync(
      workerFile,
      `import { helper } from "./helper";\nexport const foo = 1;`,
    );

    const server = createMockServer({
      rootDir: tmpDir,
      environment: "worker",
      file: workerFile,
    });

    await callHotUpdate(plugin, { file: workerFile, server });

    expect(runDirectivesScan).toHaveBeenCalledTimes(1);
  });

  it("skips runDirectivesScan when only the file body changes", async () => {
    writeFileSync(
      workerFile,
      `import { helper } from "./helper";\nexport const foo = 1;`,
    );

    const server = createMockServer({
      rootDir: tmpDir,
      environment: "worker",
      file: workerFile,
    });

    await callHotUpdate(plugin, { file: workerFile, server });
    expect(runDirectivesScan).toHaveBeenCalledTimes(1);

    writeFileSync(
      workerFile,
      `import { helper } from "./helper";\nexport const foo = 2;`,
    );

    await callHotUpdate(plugin, { file: workerFile, server });
    expect(runDirectivesScan).toHaveBeenCalledTimes(1);
  });

  it("runs runDirectivesScan again when the import signature changes", async () => {
    writeFileSync(
      workerFile,
      `import { helper } from "./helper";\nexport const foo = 1;`,
    );

    const server = createMockServer({
      rootDir: tmpDir,
      environment: "worker",
      file: workerFile,
    });

    await callHotUpdate(plugin, { file: workerFile, server });
    expect(runDirectivesScan).toHaveBeenCalledTimes(1);

    writeFileSync(
      workerFile,
      `import { helper } from "./other";\nexport const foo = 1;`,
    );

    await callHotUpdate(plugin, { file: workerFile, server });
    expect(runDirectivesScan).toHaveBeenCalledTimes(2);
  });
});
