import { $ } from "../lib/$.mjs";

export const __sdk = async (arg: string) => {
  console.log("Resetting development environment...");

  await $({
    shell: true,
  })`(cd ../../sdk && NODE_ENV=development pnpm build) && pnpm clean:vite && rm -r node_modules/@redwoodjs/sdk/dist && cp -r ../../sdk/{package.json,dist} node_modules/@redwoodjs/sdk/`;

  if (arg) {
    await $({ stdio: "inherit" })`pnpm ${arg}`;
  }
};

if (import.meta.url === new URL(process.argv[1], import.meta.url).href) {
  const arg = process.argv[2];
  __sdk(arg);
}
