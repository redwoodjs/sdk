# @redwoodjs/sdk

@redwoodjs/sdk is a framework built on top of [Cloudflare's Platform](https://developers.cloudflare.com/), Request/ Response cycle and React Server Components.

- _Cloudflare's platform_ supplies compute (Workers/ Durable Objects), storage (R2), database (D1), and queues. Everything developers need to effectively build software for the web.
- _React Server components_ enable modern server-side rendering with React.
- _Request/ Response cycle_ provides a meaningful standard way to handle web interactions.

Note: This project is not officially released, but we're very near to be beta.

## Getting Started

```terminal
pnpm install
```

## Running the Docs Locally

```terminal
cd docs
pnpm dev
```

## Running one of the Experiments locally

Each [experiment](./experiments/) should have it's own README with instructions

## Building a Project locally

We have starter specific instructions

- [Minimal](./starters/minimal/README.md) for smaller projects, no db required
- [Prisma](./starters/prisma/README.md) for projects that use Prisma as an ORM, integrates with Cloudflare d1
- [Drizzle](./starters/drizzle/README.md) for projects that use Drizzle as an ORM, integrates with Cloudflare d1
- [Sessions](./starters/sessions/README.md) for projects that need session management
- [Passkey Auth](./starters/passkey-auth/README.md) for projects that want password-less authentication using WebAuthn
