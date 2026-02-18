import { Tab, Tabs } from "fumadocs-ui/components/tabs";

const commands: Record<string, Record<string, string>> = {
  add: { npm: "npm install", yarn: "yarn add", pnpm: "pnpm add", bun: "bun add" },
  exec: { npm: "npx", yarn: "yarn dlx", pnpm: "pnpm dlx", bun: "bunx" },
  run: { npm: "npm run", yarn: "yarn", pnpm: "pnpm", bun: "bun run" },
  create: { npm: "npm create", yarn: "yarn create", pnpm: "pnpm create", bun: "bun create" },
};

export function PackageManagers({
  pkg,
  type = "add",
}: {
  pkg?: string;
  type?: string;
}) {
  const cmdMap = commands[type] ?? commands.add;

  return (
    <Tabs groupId="package-manager" persist items={["npm", "yarn", "pnpm", "bun"]}>
      {Object.entries(cmdMap).map(([manager, cmd]) => (
        <Tab key={manager} value={manager}>
          <pre>
            <code>{`${cmd} ${pkg || ""}`.trim()}</code>
          </pre>
        </Tab>
      ))}
    </Tabs>
  );
}
