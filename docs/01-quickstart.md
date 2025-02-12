# Quickstart

Note, the package names are wrong.

<!-- we should make this package manager agnostic? -->
```terminal
pnpm init
pnpm install vite @redwoodjs/origin
```

## Initial setup

```terminal
touch vite.config.mts
```

```typescript
// vite.config.mts
import { defineConfig } from 'vite'
import { redwoodJS } from '@redwoodjs/origin'

export default defineConfig({
    plugins: [
        redwoodJS()
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

