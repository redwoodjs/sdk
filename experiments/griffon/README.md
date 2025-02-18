# Griffon: Command and Control.

Griffon is gateway application to transform sensory data into usable objects for many command and control applications.

The technical stack is Redwood SDK, React Server Components, Prisma, Tailwind, ShadCDN/UI and Cloudflare.

## Development

Database migrations are a bit complicated, and more manual, with Prisma and D1. The basic gist is that you cannot use Prisma's `prisma migrate dev` command to automatically create the migrations.

Check the documentation for further information:
https://www.prisma.io/docs/orm/overview/databases/cloudflare-d1#evolve-your-schema-with-further-migrations

## Installation

Create your database:
```terminal
npx wrangler d1 create griffon
```

Copy the ID that's spat out by this command, and update the wrangler.toml file.

```terminal
pnpm dev:init
pnpm dev
```

## Deployment

You'll need a cloudflare account.

<!-- note(2025-01-06, peterp):
  Is it possible to create a cloudlfare account programatically.
-->

```terminal
npx wrangler deploy
```
