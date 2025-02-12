# Start from scratch

This guide aims to give you all the parts you need to use Redwood. It is a bit more involved than using the quickstart (which doesn't exist yet), but allows you to clearly see all the moving parts in an incremental fashion.


Install the dependencies.

```terminal
pnpm init
pnpm install vite @redwoodjs/reloaded typescript wrangler
```

Create a TypeScript configuration file.

```terminal
pnpm install @tsconfig/recommended
touch tsconfig.json
```

```json(tsconfig.json)
{ 
    "extends": "@tsconfig/vite-react/tsconfig.json"
}
```

Create a Wrangler configuration file:

```toml(wrangler.toml)
#:schema node_modules/wrangler/config-schema.json
name = "<name>"
main = "src/worker.tsx"
compatibility_date = "2024-09-23"
compatibility_flags = ["nodejs_compat"]
assets = { binding = "ASSETS" }

workers_dev = false

[observability]
enabled = true


[durable_objects]
bindings = [
  { name = "SESSION_DO", class_name = "SessionDO" }
]

[[migrations]]
tag = "v1"
new_classes = [ "SessionDO" ]
```



Create a Vite configuration file:

```terminal
touch vite.config.mts
```

```typescript(vite.config.mts)
import { defineConfig } from 'vite'
import { redwood } from '@redwoodjs/reloaded`

export default defineConfig({
    plugins: [
        redwood(),
    ]
})
```






## Entry file

```terminal
mkdir src
mkdir src/worker.tsx
```
<!-- I wonder what an ordinary worker looks like? -->
<!-- I wonder why we name it ".tsx?" -->
<!-- I am not a fan of HEAD.tsx, but I guess that's because we don't programatically inject the vite stuff during development. -->
```typescript
// src/worker.ts

import { defineApp, index } from '@redwoodjs/reloaded/worker';

const routes = [
    index(function() {
        return new Response('Hello, world!')
    })
]

export default defineApp({
  routes,
})
```

Now run it!

```
pnpm dev
```

## How to render pages

A JSX component can be returned from any route. Server components are the default, so if you need interactivity remember to specify "use client" in the component.

<!-- Show example or rendering a page -->

## How to database

We suggest using Prisma. We've already setup most of the things required to get it working. (It was difficult.)

```terminal
mkdir prisma
touch prisma/schema.prisma

```
<!-- Show example field -->
```prisma
// prisma/schema.prisma
```


### Migrations

Unfortunately Prisma needs to know where the Cloudflare D1 database is located on your development machine, it cannot know this unless the miniflare environment is present, because of this we had to "hack" the Prisma migration system. We expect this is temporary.

To create a migration
```terminal
pnpm migrate:new "migration summary"
```

To apply a migration
```terminal
pnpm migrate:dev
```

## How to JSX and RSC?

