import { $ } from "../lib/$.mjs";

export const __sdk = async (...args: string[]) => {
  console.log("Resetting development environment...");

  await $({
    shell: true,
  })`(cd ../../sdk && NODE_ENV=development pnpm build) && pnpm clean:vite && rm -r node_modules/rwsdk/dist && cp -r ../../sdk/{package.json,dist} node_modules/rwsdk/`;

  if (args.length > 0) {
    await $({ stdio: "inherit" })`pnpm ${args.join(" ")}`;
  }
};

if (import.meta.url === new URL(process.argv[1], import.meta.url).href) {
  const args = process.argv.slice(2);
  __sdk(...args);
}
