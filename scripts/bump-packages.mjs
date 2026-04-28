import { readFileSync, writeFileSync } from "fs";
import { execSync } from "child_process";
import { join, relative } from "path";

const REPO = "/home/vscode/repo";

const COMMON_BUMPS = [
  { depType: "devDependencies", pkg: "@cloudflare/vite-plugin", old: "1.30.1", new: "1.33.2" },
  { depType: "devDependencies", pkg: "@cloudflare/vite-plugin", old: "1.31.0", new: "1.33.2" },
  { depType: "devDependencies", pkg: "@cloudflare/workers-types", old: "4.20260331.1", new: "4.20260426.1" },
  { depType: "devDependencies", pkg: "wrangler", old: "4.77.0", new: "4.85.0" },
  { depType: "devDependencies", pkg: "wrangler", old: "4.79.0", new: "4.85.0" },
  { depType: "devDependencies", pkg: "@types/node", old: "24.10.4", new: "~25.6.0" },
  { depType: "devDependencies", pkg: "@types/node", old: "~24.12.0", new: "~25.6.0" },
  { depType: "devDependencies", pkg: "typescript", old: "5.9.3", new: "6.0.3" },
  { depType: "devDependencies", pkg: "typescript", old: "6.0.2", new: "6.0.3" },
  { depType: "dependencies", pkg: "@cloudflare/workers-types", old: "4.20260331.1", new: "4.20260426.1" },
  { depType: "dependencies", pkg: "@cloudflare/workers-types", old: "4.20260405.1", new: "4.20260426.1" },
  { depType: "dependencies", pkg: "@types/node", old: "24.10.4", new: "~25.6.0" },
  { depType: "dependencies", pkg: "@types/node", old: "~24.12.0", new: "~25.6.0" },
  { depType: "dependencies", pkg: "typescript", old: "5.9.3", new: "6.0.3" },
  { depType: "dependencies", pkg: "typescript", old: "6.0.2", new: "6.0.3" },
];

const SPECIFIC_BUMPS = [
  // docs
  { file: "docs/package.json", depType: "dependencies", pkg: "@base-ui/react", old: "^1.2.0", new: "^1.4.1" },
  { file: "docs/package.json", depType: "dependencies", pkg: "fumadocs-core", old: "^16.7.6", new: "^16.8.5" },
  { file: "docs/package.json", depType: "dependencies", pkg: "fumadocs-mdx", old: "^14.2.7", new: "^14.3.2" },
  { file: "docs/package.json", depType: "dependencies", pkg: "tailwindcss", old: "^4.1.13", new: "^4.2.4" },
  { file: "docs/package.json", depType: "devDependencies", pkg: "@fumadocs/base-ui", old: "^16.7.4", new: "^16.8.5" },
  { file: "docs/package.json", depType: "devDependencies", pkg: "@tailwindcss/vite", old: "^4.1.6", new: "^4.2.4" },
  { file: "docs/package.json", depType: "devDependencies", pkg: "oxfmt", old: "^0.43.0", new: "^0.47.0" },
  { file: "docs/package.json", depType: "devDependencies", pkg: "oxlint", old: "^1.58.0", new: "^1.62.0" },
  // playground/mantine
  { file: "playground/mantine/package.json", depType: "dependencies", pkg: "@mantine/core", old: "^9.0.0", new: "^9.1.1" },
  { file: "playground/mantine/package.json", depType: "dependencies", pkg: "@mantine/hooks", old: "^9.0.0", new: "^9.1.1" },
  { file: "playground/mantine/package.json", depType: "devDependencies", pkg: "postcss", old: "^8.5.8", new: "^8.5.12" },
  // playground/shadcn
  { file: "playground/shadcn/package.json", depType: "dependencies", pkg: "lucide-react", old: "^1.7.0", new: "^1.11.0" },
  { file: "playground/shadcn/package.json", depType: "dependencies", pkg: "react-hook-form", old: "^7.72.0", new: "^7.74.0" },
  { file: "playground/shadcn/package.json", depType: "dependencies", pkg: "react-resizable-panels", old: "^4.7.2", new: "^4.10.0" },
  { file: "playground/shadcn/package.json", depType: "dependencies", pkg: "tailwindcss", old: "^4.2.1", new: "^4.2.4" },
  { file: "playground/shadcn/package.json", depType: "devDependencies", pkg: "@tailwindcss/vite", old: "^4.2.1", new: "^4.2.4" },
  { file: "playground/shadcn/package.json", depType: "devDependencies", pkg: "shadcn", old: "^4.1.2", new: "^4.5.0" },
  // playground/resend
  { file: "playground/resend/package.json", depType: "dependencies", pkg: "@react-email/components", old: "^1.0.8", new: "^1.0.12" },
  { file: "playground/resend/package.json", depType: "dependencies", pkg: "@react-email/render", old: "^2.0.4", new: "^2.0.7" },
  { file: "playground/resend/package.json", depType: "dependencies", pkg: "resend", old: "^6.10.0", new: "^6.12.2" },
  // playground/storybook
  { file: "playground/storybook/package.json", depType: "devDependencies", pkg: "@storybook/addon-a11y", old: "^10.3.3", new: "^10.3.5" },
  { file: "playground/storybook/package.json", depType: "devDependencies", pkg: "@storybook/addon-docs", old: "^10.3.3", new: "^10.3.5" },
  { file: "playground/storybook/package.json", depType: "devDependencies", pkg: "@storybook/addon-links", old: "^10.3.3", new: "^10.3.5" },
  { file: "playground/storybook/package.json", depType: "devDependencies", pkg: "@storybook/addon-vitest", old: "^10.3.3", new: "^10.3.5" },
  { file: "playground/storybook/package.json", depType: "devDependencies", pkg: "@storybook/react", old: "^10.3.3", new: "^10.3.5" },
  { file: "playground/storybook/package.json", depType: "devDependencies", pkg: "@storybook/react-vite", old: "^10.3.3", new: "^10.3.5" },
  { file: "playground/storybook/package.json", depType: "devDependencies", pkg: "storybook", old: "^10.3.3", new: "^10.3.5" },
  // playground/content-collections
  { file: "playground/content-collections/package.json", depType: "dependencies", pkg: "@content-collections/core", old: "^0.14.3", new: "^0.15.0" },
  { file: "playground/content-collections/package.json", depType: "dependencies", pkg: "@content-collections/vite", old: "^0.2.9", new: "^0.3.0" },
  // playground/community/todo-serverquery-and-actions
  { file: "playground/community/todo-serverquery-and-actions/package.json", depType: "dependencies", pkg: "tailwindcss", old: "^4.2.1", new: "^4.2.4" },
  { file: "playground/community/todo-serverquery-and-actions/package.json", depType: "devDependencies", pkg: "@tailwindcss/vite", old: "^4.2.1", new: "^4.2.4" },
  // playground/database-do
  { file: "playground/database-do/package.json", depType: "dependencies", pkg: "kysely", old: "^0.28.15", new: "^0.28.16" },
  // community
  { file: "community/package.json", depType: "devDependencies", pkg: "@cloudflare/workers-types", old: "~4.20260331.1", new: "~4.20260426.1" },
  { file: "community/package.json", depType: "devDependencies", pkg: "vitest", old: "~4.1.2", new: "~4.1.5" },
  // community/playground/ark-ui-showcase
  { file: "community/playground/ark-ui-showcase/package.json", depType: "dependencies", pkg: "@ark-ui/react", old: "^5.35.0", new: "^5.36.2" },
  { file: "community/playground/ark-ui-showcase/package.json", depType: "dependencies", pkg: "lucide-react", old: "^1.7.0", new: "^1.11.0" },
  // community/playground/chakra-ui-showcase
  { file: "community/playground/chakra-ui-showcase/package.json", depType: "dependencies", pkg: "@chakra-ui/react", old: "^3.34.0", new: "^3.35.0" },
  // community/playground/vitest-showcase
  { file: "community/playground/vitest-showcase/package.json", depType: "devDependencies", pkg: "@cloudflare/vitest-pool-workers", old: "^0.12.21", new: "^0.15.0" },
  // playground/chakra-ui
  { file: "playground/chakra-ui/package.json", depType: "dependencies", pkg: "@chakra-ui/react", old: "^3.34.0", new: "^3.35.0" },
  // playground/monorepo-top-level-deps/packages/project
  { file: "playground/monorepo-top-level-deps/packages/project/package.json", depType: "devDependencies", pkg: "typescript", old: "5.9.3", new: "6.0.3" },
  { file: "playground/monorepo-top-level-deps/packages/project/package.json", depType: "devDependencies", pkg: "vitest", old: "^4.0.18", new: "^4.1.5" },
];

function updateJson(filePath, bumps) {
  const text = readFileSync(filePath, "utf-8");
  const data = JSON.parse(text);
  let modified = false;
  for (const bump of bumps) {
    const section = data[bump.depType];
    if (section && section[bump.pkg] === bump.old) {
      section[bump.pkg] = bump.new;
      modified = true;
    }
  }
  if (modified) {
    writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n");
    console.log("Updated:", relative(REPO, filePath));
  }
  return modified;
}

let count = 0;

// Apply common bumps to all package.json files
const files = execSync("find /home/vscode/repo -name 'package.json' -not -path '*/node_modules/*' -not -path '*/.git/*'", { encoding: "utf-8" })
  .trim()
  .split("\n")
  .filter(Boolean);

for (const file of files) {
  if (updateJson(file, COMMON_BUMPS)) count++;
}

// Apply specific bumps
for (const bump of SPECIFIC_BUMPS) {
  const file = join(REPO, bump.file);
  if (updateJson(file, [{ depType: bump.depType, pkg: bump.pkg, old: bump.old, new: bump.new }])) {
    count++;
  }
}

console.log("\nTotal files modified:", count);
