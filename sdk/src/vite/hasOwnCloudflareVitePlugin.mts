import { readFile } from "fs/promises";
import path from "path";

export async function hasOwnCloudflareVitePlugin({
  rootProjectDir,
}: {
  rootProjectDir: string;
}) {
  const packageJsonPath = path.join(rootProjectDir, "package.json");
  try {
    const packageJson = JSON.parse(await readFile(packageJsonPath, "utf-8"));
    return !!(
      packageJson.dependencies?.["@cloudflare/vite-plugin"] ||
      packageJson.devDependencies?.["@cloudflare/vite-plugin"]
    );
  } catch (error) {
    console.error("Error reading package.json:", error);
    return false;
  }
}
