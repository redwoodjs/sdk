# Minimal Starter

This starter gives you a bare-bones RedwoodJS project.

Clone the repo

```shell
git clone https://github.com/redwoodjs/sdk.git
```

Run

```shell
pnpm install
```

Go into the `sdk` directory and build the project

```shell
cd sdk
pnpm build
```

Duplicate the `starters/minimal` directory.

Rename the folder and move into the `experiments` directory

Add your new project to the `pnpm-workspace.yaml` file. (_This example assumes your new project is called `showofhands`_)

```yaml "experiments/showofhands"
packages:
  - "sdk"
  - "experiments/billable"
  - "experiments/yt-dos"
  - "experiments/showofhands"
  - "starters/minimal"
  - "starters/prisma"
```

```shell
pnpm i
```

Change the name of your experiment’s `package.json`. For example:

```json "@redwoodjs/starter-prisma"
  "name": "@redwoodjs/starter-prisma",
```

Update the path in this script:

```json "__change-me__"
"__reset:reinstall": "(cd ../../ && rm -rf node_modules && rm -rf sdk/node_modules && rm -rf experiments/__change-me__/node_modules && pnpm install)",
```

Within your experiment’s `wrangler.toml` file, change every instance of `__change_me__`

For example:

```toml "__change_me__"
#:schema node_modules/wrangler/config-schema.json
name = "__change_me__"
main = "src/worker.tsx"
compatibility_date = "2024-09-23"
compatibility_flags = ["nodejs_compat"]
assets = { binding = "ASSETS", directory = "public" }

workers_dev = false
routes = [
  { pattern = "__change_me__", custom_domain = true }
]

[observability]
enabled = true
```