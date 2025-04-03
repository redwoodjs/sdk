import { $ } from "../lib/$.mjs";

export const debugSync = async () => {
  const targetDir = process.argv[2];

  if (!targetDir) {
    console.error("❌ Please provide a target directory as an argument.");
    process.exit(1);
  }

  const command = `echo syncing... && pnpm tsc && rm -rf ${targetDir}/node_modules/@redwoodjs/sdk/dist && cp -r dist ${targetDir}/node_modules/@redwoodjs/sdk/ && echo done`;

  $({
    stdio: "inherit",
    shell: true,
  })`npx chokidar-cli './src/**' -c "${command}"`;
};

if (import.meta.url === new URL(process.argv[1], import.meta.url).href) {
  debugSync();
}
