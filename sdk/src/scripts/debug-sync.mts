import { $ } from "../lib/$.mjs";

export const debugSync = async () => {
  const targetDir = process.argv[2];

  if (!targetDir) {
    console.error("❌ Please provide a target directory as an argument.");
    process.exit(1);
  }

  const srcCommand = `echo syncing src... && pnpm tsc && rm -rf ${targetDir}/node_modules/@redwoodjs/sdk/dist && cp -r dist ${targetDir}/node_modules/@redwoodjs/sdk/ && echo done`;

  const vendorCommand = `echo syncing vendor... && pnpm run build:vendor && rm -rf ${targetDir}/node_modules/@redwoodjs/sdk/vendor/dist && cp -r vendor/dist ${targetDir}/node_modules/@redwoodjs/sdk/vendor/ && echo done`;

  // Watch src files
  $({
    stdio: "inherit",
    shell: true,
  })`npx chokidar-cli './src/**' -c "${srcCommand}"`;

  // Watch vendor source files and build config
  $({
    stdio: "inherit",
    shell: true,
  })`npx chokidar-cli './vendor/src/**' './src/scripts/build-vendor-bundles.mts' -c "${vendorCommand}"`;
};

if (import.meta.url === new URL(process.argv[1], import.meta.url).href) {
  debugSync();
}
