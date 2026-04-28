#!/usr/bin/env python3
"""Bulk-update package.json files across the workspace."""

import json
import os
from pathlib import Path

REPO = Path("/home/vscode/repo")

# Common alignment bumps applied to ALL package.json files
COMMON_BUMPS = {
    ("devDependencies", "@cloudflare/vite-plugin", "1.30.1"): "1.33.2",
    ("devDependencies", "@cloudflare/vite-plugin", "1.31.0"): "1.33.2",
    ("devDependencies", "@cloudflare/workers-types", "4.20260331.1"): "4.20260426.1",
    ("devDependencies", "wrangler", "4.77.0"): "4.85.0",
    ("devDependencies", "wrangler", "4.79.0"): "4.85.0",
    ("devDependencies", "@types/node", "24.10.4"): "~25.6.0",
    ("devDependencies", "@types/node", "~24.12.0"): "~25.6.0",
    ("devDependencies", "typescript", "5.9.3"): "6.0.3",
    ("devDependencies", "typescript", "6.0.2"): "6.0.3",
    ("dependencies", "@cloudflare/workers-types", "4.20260331.1"): "4.20260426.1",
    ("dependencies", "@cloudflare/workers-types", "4.20260405.1"): "4.20260426.1",
    ("dependencies", "@types/node", "24.10.4"): "~25.6.0",
    ("dependencies", "@types/node", "~24.12.0"): "~25.6.0",
    ("dependencies", "typescript", "5.9.3"): "6.0.3",
    ("dependencies", "typescript", "6.0.2"): "6.0.3",
}

# Per-package bumps for specific files
# Format: (relative_path, dep_type, package_name, old_version): new_version
SPECIFIC_BUMPS = {
    # docs
    ("docs/package.json", "dependencies", "@base-ui/react", "^1.2.0"): "^1.4.1",
    ("docs/package.json", "dependencies", "fumadocs-core", "^16.7.6"): "^16.8.5",
    ("docs/package.json", "dependencies", "fumadocs-mdx", "^14.2.7"): "^14.3.2",
    ("docs/package.json", "dependencies", "fumadocs-ui", "npm:@fumadocs/base-ui@latest"): "npm:@fumadocs/base-ui@latest",
    ("docs/package.json", "dependencies", "tailwindcss", "^4.1.13"): "^4.2.4",
    ("docs/package.json", "devDependencies", "@fumadocs/base-ui", "^16.7.4"): "^16.8.5",
    ("docs/package.json", "devDependencies", "@tailwindcss/vite", "^4.1.6"): "^4.2.4",
    ("docs/package.json", "devDependencies", "oxfmt", "^0.43.0"): "^0.47.0",
    ("docs/package.json", "devDependencies", "oxlint", "^1.58.0"): "^1.62.0",
    # playground/mantine
    ("playground/mantine/package.json", "dependencies", "@mantine/core", "^9.0.0"): "^9.1.1",
    ("playground/mantine/package.json", "dependencies", "@mantine/hooks", "^9.0.0"): "^9.1.1",
    ("playground/mantine/package.json", "devDependencies", "postcss", "^8.5.8"): "^8.5.12",
    # playground/shadcn
    ("playground/shadcn/package.json", "dependencies", "lucide-react", "^1.7.0"): "^1.11.0",
    ("playground/shadcn/package.json", "dependencies", "react-hook-form", "^7.72.0"): "^7.74.0",
    ("playground/shadcn/package.json", "dependencies", "react-resizable-panels", "^4.7.2"): "^4.10.0",
    ("playground/shadcn/package.json", "dependencies", "tailwindcss", "^4.2.1"): "^4.2.4",
    ("playground/shadcn/package.json", "devDependencies", "@tailwindcss/vite", "^4.2.1"): "^4.2.4",
    ("playground/shadcn/package.json", "devDependencies", "shadcn", "^4.1.2"): "^4.5.0",
    # playground/resend
    ("playground/resend/package.json", "dependencies", "@react-email/components", "^1.0.8"): "^1.0.12",
    ("playground/resend/package.json", "dependencies", "@react-email/render", "^2.0.4"): "^2.0.7",
    ("playground/resend/package.json", "dependencies", "resend", "^6.10.0"): "^6.12.2",
    # playground/storybook
    ("playground/storybook/package.json", "devDependencies", "@storybook/addon-a11y", "^10.3.3"): "^10.3.5",
    ("playground/storybook/package.json", "devDependencies", "@storybook/addon-docs", "^10.3.3"): "^10.3.5",
    ("playground/storybook/package.json", "devDependencies", "@storybook/addon-links", "^10.3.3"): "^10.3.5",
    ("playground/storybook/package.json", "devDependencies", "@storybook/addon-vitest", "^10.3.3"): "^10.3.5",
    ("playground/storybook/package.json", "devDependencies", "@storybook/react", "^10.3.3"): "^10.3.5",
    ("playground/storybook/package.json", "devDependencies", "@storybook/react-vite", "^10.3.3"): "^10.3.5",
    ("playground/storybook/package.json", "devDependencies", "storybook", "^10.3.3"): "^10.3.5",
    # playground/content-collections
    ("playground/content-collections/package.json", "dependencies", "@content-collections/core", "^0.14.3"): "^0.15.0",
    ("playground/content-collections/package.json", "dependencies", "@content-collections/vite", "^0.2.9"): "^0.3.0",
    # playground/community/todo-serverquery-and-actions
    ("playground/community/todo-serverquery-and-actions/package.json", "dependencies", "tailwindcss", "^4.2.1"): "^4.2.4",
    ("playground/community/todo-serverquery-and-actions/package.json", "devDependencies", "@tailwindcss/vite", "^4.2.1"): "^4.2.4",
    # playground/database-do
    ("playground/database-do/package.json", "dependencies", "kysely", "^0.28.15"): "^0.28.16",
    # community
    ("community/package.json", "devDependencies", "@cloudflare/workers-types", "~4.20260331.1"): "~4.20260426.1",
    ("community/package.json", "devDependencies", "vitest", "~4.1.2"): "~4.1.5",
    # community/playground/ark-ui-showcase
    ("community/playground/ark-ui-showcase/package.json", "dependencies", "@ark-ui/react", "^5.35.0"): "^5.36.2",
    ("community/playground/ark-ui-showcase/package.json", "dependencies", "lucide-react", "^1.7.0"): "^1.11.0",
    # community/playground/chakra-ui-showcase
    ("community/playground/chakra-ui-showcase/package.json", "dependencies", "@chakra-ui/react", "^3.34.0"): "^3.35.0",
    # community/playground/vitest-showcase
    ("community/playground/vitest-showcase/package.json", "devDependencies", "@cloudflare/vitest-pool-workers", "^0.12.21"): "^0.15.0",
    # playground/chakra-ui
    ("playground/chakra-ui/package.json", "dependencies", "@chakra-ui/react", "^3.34.0"): "^3.35.0",
    # playground/monorepo-top-level-deps/packages/project
    ("playground/monorepo-top-level-deps/packages/project/package.json", "devDependencies", "typescript", "5.9.3"): "6.0.3",
    ("playground/monorepo-top-level-deps/packages/project/package.json", "devDependencies", "vitest", "^4.0.18"): "^4.1.5",
}

def update_pkg(path: Path, changes: dict):
    text = path.read_text()
    data = json.loads(text)
    modified = False
    for (dep_type, pkg, old_val), new_val in changes.items():
        if dep_type in data and pkg in data[dep_type]:
            if data[dep_type][pkg] == old_val:
                data[dep_type][pkg] = new_val
                modified = True
    if modified:
        # Preserve 2-space indent
        path.write_text(json.dumps(data, indent=2) + "\n")
    return modified

def main():
    # Apply common bumps to ALL package.json files
    count = 0
    for pattern in ["*/package.json", "*/*/package.json", "*/*/*/package.json", "*/*/*/*/package.json"]:
        for p in REPO.glob(pattern):
            if update_pkg(p, COMMON_BUMPS):
                count += 1
                print(f"Updated common: {p.relative_to(REPO)}")

    # Apply specific bumps
    for (rel_path, dep_type, pkg, old_val), new_val in SPECIFIC_BUMPS.items():
        p = REPO / rel_path
        if not p.exists():
            print(f"MISSING: {rel_path}")
            continue
        changes = {(dep_type, pkg, old_val): new_val}
        if update_pkg(p, changes):
            count += 1
            print(f"Updated specific: {rel_path}")

    print(f"\nTotal files modified: {count}")

if __name__ == "__main__":
    main()
