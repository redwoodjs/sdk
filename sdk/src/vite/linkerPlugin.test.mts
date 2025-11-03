import { describe, expect, it } from "vitest";
import { linkWorkerBundle } from "./linkerPlugin.mjs";

describe("linkWorkerBundle", () => {
  const projectRootDir = "/test/project";
  const manifest = {
    "src/styles.css": { file: "assets/styles.123.css" },
    "src/logo.svg": { file: "assets/logo.abc.svg" },
  };
  const manifestContent = JSON.stringify(manifest);

  it("should replace the manifest placeholder", () => {
    const code = `const manifest = "__RWSDK_MANIFEST_PLACEHOLDER__";`;
    const result = linkWorkerBundle({
      code,
      manifestContent,
      projectRootDir,
    });
    expect(result.code).toContain(`const manifest = ${manifestContent};`);
  });

  it("should replace asset placeholders with hashed paths from the manifest", () => {
    const code = `
      const stylesheet = "rwsdk_asset:/src/styles.css";
      const logo = "rwsdk_asset:/src/logo.svg";
    `;
    const result = linkWorkerBundle({
      code,
      manifestContent,
      projectRootDir,
    });
    expect(result.code).toContain(
      `const stylesheet = "/assets/styles.123.css";`,
    );
    expect(result.code).toContain(`const logo = "/assets/logo.abc.svg";`);
  });

  it("should replace asset placeholder with a base + hashed paths from the manifest if base is provided", () => {
    const code = `
      const stylesheet = "rwsdk_asset:/src/styles.css";
      const logo = "rwsdk_asset:/src/logo.svg";
    `;

    const base = "/base/";

    const result = linkWorkerBundle({
      code,
      manifestContent,
      projectRootDir,
      base,
    });
    expect(result.code).toContain(
      `const stylesheet = "/base/assets/styles.123.css";`,
    );
    expect(result.code).toContain(`const logo = "/base/assets/logo.abc.svg";`);
  });

  it("should deprefix remaining asset placeholders not in the manifest", () => {
    const code = `const publicImg = "rwsdk_asset:/images/photo.jpg";`;
    const result = linkWorkerBundle({
      code,
      manifestContent,
      projectRootDir,
    });
    expect(result.code).toContain(`const publicImg = "/images/photo.jpg";`);
  });
});
