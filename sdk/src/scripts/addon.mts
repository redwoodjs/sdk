import decompress from "decompress";
import { findUp } from "find-up";
import { createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream } from "node:stream/web";

async function getRwSdkProjectRootDir(cwd: string) {
  const packageJsonPath = await findUp("package.json", { cwd });

  if (packageJsonPath) {
    return path.dirname(packageJsonPath);
  }

  return cwd;
}

export const addon = async () => {
  const addonName = process.argv[2];

  if (
    !addonName ||
    process.argv.find((arg) => arg === "-h") ||
    process.argv.find((arg) => arg === "--help")
  ) {
    console.error("Please specify the addon name.");
    console.error(`Usage: npx rwsdk addon <addon-name>`);
    process.exit(1);
  }

  try {
    const projectRootDir = await getRwSdkProjectRootDir(process.cwd());
    const packageJsonPath = path.resolve(projectRootDir, "package.json");
    const packageJsonContent = await fs.readFile(packageJsonPath, "utf-8");
    const { dependencies, devDependencies } = JSON.parse(packageJsonContent);

    let rwsdkVersion = dependencies?.rwsdk || devDependencies?.rwsdk;

    if (rwsdkVersion === "workspace:*") {
      throw new Error(
        'The "rwsdk" dependency is set to "workspace:*". Please use a specific version of the SDK.',
      );
    }

    if (!rwsdkVersion) {
      console.error(
        'Could not find "rwsdk" in your dependencies or devDependencies.',
      );
      process.exit(1);
    }

    if (/^\d/.test(rwsdkVersion)) {
      rwsdkVersion = `v${rwsdkVersion}`;
    }

    const tmpDirPrefix = path.join(os.tmpdir(), `rwsdk-addon-${addonName}-`);
    const tmpDir = await fs.mkdtemp(tmpDirPrefix);

    const downloadUrl = `https://github.com/redwoodjs/sdk/releases/download/${rwsdkVersion}/${addonName}-${rwsdkVersion}.tar.gz`;
    console.log(`Downloading addon "${addonName}" version ${rwsdkVersion}...`);

    const filePath = path.join(
      os.tmpdir(),
      `rwsdk-addon-${addonName}-${rwsdkVersion}.tar.gz`,
    );

    const response = await fetch(downloadUrl);
    if (!response.ok) {
      console.error(`Error downloading addon: ${response.statusText}`);
      process.exit(1);
    }

    if (!response.body) {
      console.error(
        `\nError: Failed to download addon "${addonName}". The response contained no data.`,
      );
      process.exit(1);
    }

    await pipeline(
      Readable.fromWeb(response.body as ReadableStream),
      createWriteStream(filePath),
    );

    await decompress(filePath, tmpDir);

    console.log();
    console.log("Download complete!");
    console.log(`The addon files are located in: ${tmpDir}`);
    console.log();
    console.log("To continue, open the step-by-step instructions:");

    const instructionsPath = path.join(tmpDir, "INSTRUCTIONS.md");
    console.log(`code ${instructionsPath}`);
  } catch (e: any) {
    console.error(
      `Could not download addon "${addonName}". Please check the name and try again.`,
    );
    console.error(e.message);
    process.exit(1);
  }
};

if (import.meta.url === new URL(process.argv[1], import.meta.url).href) {
  addon();
}
