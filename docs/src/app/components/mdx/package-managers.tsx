import { Tab, Tabs } from "fumadocs-ui/components/tabs";

type CommandType = "add" | "dlx" | "install" | "run" | "create" | "exec";

const commands: Record<CommandType, Record<string, string>> = {
  add: { npm: "npm install", yarn: "yarn add", pnpm: "pnpm add", bun: "bun add" },
  dlx: { npm: "npx", yarn: "yarn dlx", pnpm: "pnpx", bun: "bunx" },
  exec: { npm: "npx", yarn: "yarn dlx", pnpm: "pnpx", bun: "bunx" },
  install: { npm: "npm install", yarn: "yarn install", pnpm: "pnpm install", bun: "bun install" },
  run: { npm: "npm run", yarn: "yarn run", pnpm: "pnpm run", bun: "bun run" },
  create: { npm: "npm create", yarn: "yarn create", pnpm: "pnpm create", bun: "bun create" },
};

export function PackageManagers({
  pkg,
  type = "add",
  args,
}: {
  pkg?: string;
  type?: string;
  args?: string;
}) {
  const cmdMap = commands[type as CommandType] ?? commands.add;
  const suffix = [pkg, args].filter(Boolean).join(" ");

  return (
    <Tabs groupId="package-manager" items={["npm", "yarn", "pnpm", "bun"]}>
      {Object.entries(cmdMap).map(([manager, cmd]) => (
        <Tab key={manager} value={manager}>
          <pre>
            <code>{suffix ? `${cmd} ${suffix}` : cmd}</code>
          </pre>
        </Tab>
      ))}
    </Tabs>
  );
}
