# Billable. Billing Made Simple. Period.

Billable is personal invoicing software that allows a user to input information about their business entity, the client, and items, quanitities and prices. It calculates the total, and includes the ability to add tax.

The technical stack is Redwood Reloaded, React Server Components, Prisma, Tailwind, ShadCDN/UI and Cloudflare.

## Installation

```terminal
pnpm install
pnpm migrate:dev
pnpm dev
```

## Deployment

You'll need a cloudflare account.

<!-- note(2025-01-06, peterp):
  Is it possible to create a cloudlfare account programatically.
  Another thing I don't understand how to do is dynamically creating resources in cloudflare,
  the database is a static string.
-->

```terminal
npm wrangler deploy
```
