# Drizzle ORM with Durable Objects Playground

This playground demonstrates how to use Drizzle ORM with Cloudflare Durable Objects in RedwoodSDK.

## Features

- Uses Drizzle ORM for type-safe database queries
- Stores data in a Cloudflare Durable Object with SQLite
- Demonstrates CRUD operations with a todo list application
- Uses sqlite-proxy pattern to communicate between worker and Durable Object

## Running the dev server

```shell
pnpm dev
```

Point your browser to the URL displayed in the terminal (e.g. `http://localhost:5173/`).

## Seeding the database

```shell
pnpm seed
```

This will populate the database with sample todos.

## Further Reading

- [RedwoodSDK Documentation](https://docs.rwsdk.com/)
- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [Cloudflare Durable Objects Documentation](https://developers.cloudflare.com/durable-objects/)
