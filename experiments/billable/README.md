# Billable: Billing Made Simple. Period.

Billable is personal invoicing software that allows a user to input information about their business entity, the client, and items, quanitities and prices. It calculates the total, and includes the ability to add tax.

The technical stack is Redwood Reloaded, React Server Components, Prisma, Tailwind, ShadCDN/UI and Cloudflare.

## Development

Database migrations are a bit complicated, and more manual, with Prisma and D1. The basic gist is that you cannot use Prisma's `prisma migrate dev` command to automatically create the migrations.

Check the documentation for further information:
https://www.prisma.io/docs/orm/overview/databases/cloudflare-d1#evolve-your-schema-with-further-migrations

## Installation

Create your database:
```terminal
npx wrangler d1 create billable
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
npm wrangler deploy
```
