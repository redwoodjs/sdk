import { readFile } from "fs/promises";
import path from "path";

export async function hasOwnReactVitePlugin({
  rootProjectDir,
}: {
  rootProjectDir: string;
}) {
  const packageJsonPath = path.join(rootProjectDir, "package.json");
  try {
    const packageJson = JSON.parse(await readFile(packageJsonPath, "utf-8"));
    return !!(
      packageJson.dependencies?.["@vitejs/plugin-react"] ||
      packageJson.devDependencies?.["@vitejs/plugin-react"]
    );
  } catch (error) {
    console.error("Error reading package.json:", error);
    return false;
  }
}
