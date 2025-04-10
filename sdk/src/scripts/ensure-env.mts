import { setupEnvFiles } from "../lib/setupEnvFiles.mjs";

export const ensureEnv = async () => {
  await setupEnvFiles({
    rootDir: process.cwd(),
  });
};

if (import.meta.url === new URL(process.argv[1], import.meta.url).href) {
  ensureEnv();
}
