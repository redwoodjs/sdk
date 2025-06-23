import { readJson } from "fs-extra";
import path from "path";

export async function hasOwnCloudflareVitePlugin({
  rootProjectDir,
}: {
  rootProjectDir: string;
}) {
  const packageJsonPath = path.join(rootProjectDir, "package.json");
  try {
    const packageJson = await readJson(packageJsonPath);
    return !!(
      packageJson.dependencies?.["@cloudflare/vite-plugin"] ||
      packageJson.devDependencies?.["@cloudflare/vite-plugin"]
    );
  } catch (error) {
    console.error("Error reading package.json:", error);
    return false;
  }
}
