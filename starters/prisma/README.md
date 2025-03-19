# Starter with Prisma

This starter makes it easy to start up a project with database using Prisma.

## Creating your project

```shell
npx degit redwoodjs/sdk/starters/prisma my-project-name
cd my-project-name
pnpm install
```

## Running the dev server

```shell
pnpm dev
```

Point your browser to the URL displayed in the terminal (e.g. `http://localhost:2332/`). You should see a "Hello World" message in your browser.

## Deploying your app

Within your project's `wrangler.jsonc` file, replace the placeholder values. For example:

```jsonc:wrangler.jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "my-project-name",
  "main": "src/worker.tsx",
  "compatibility_date": "2024-09-23",
  "compatibility_flags": ["nodejs_compat"],
  "assets": {
    "binding": "ASSETS",
    "directory": "public"
  },
  "workers_dev": false,
  "routes": [
    {
      "pattern": "my-project-name.example.com",
      "custom_domain": true
    }
  ],
  "observability": {
    "enabled": true
  },
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "my-project-db",
      "database_id": "YOUR-DB-ID-HERE"
    }
  ],
  "r2_buckets": [
    {
      "bucket_name": "my-project-bucket",
      "binding": "R2"
    }
  ],
  "migrations": [
    {
      "tag": "v1",
      "new_classes": ["SessionDO"]
    }
  ],
  "vars": {
    "SECRET_KEY": "secret",
    "APP_URL": "https://my-project-name.example.com"
  }
}
```

You'll need a [Cloudflare account](https://www.cloudflare.com/) as this starter uses Cloudflare D1 for the database.

Create a new D1 database:

```shell
npx wrangler d1 create my-project-db
```

![terminal](./public/images/terminal.png)

Copy the `database_id` from the output and paste it into your project's `wrangler.jsonc` file.

If you need to find your database ID later, you can find it in your Cloudflare dashboard:

![Cloudflare Account](./public/images/cloudflare.png)

The starter includes a basic user model in `prisma/schema.prisma`:

```prisma
model User {
  id                String    @id @default(uuid())
  email             String    @unique
  createdAt         DateTime  @default(now())
  updatedAt         DateTime? @updatedAt
}
```

### Database Changes

When you need to make changes to your database schema:

1. Update your `schema.prisma` file
2. Create a migration: `pnpm migrate:new "describe your changes"`
3. Apply the migration: `pnpm migrate:dev`

### Recommended Tools

VS Code extensions that make development easier:

- [SQLite Viewer](https://marketplace.cursorapi.com/items?itemName=qwtel.sqlite-viewer)
- [Prisma](https://marketplace.visualstudio.com/items?itemName=Prisma.prisma)

For database management, we recommend [Bee Keeper Studio](https://www.beekeeperstudio.io/).

## Further Reading

- [Prisma Documentation](https://www.prisma.io/docs)
