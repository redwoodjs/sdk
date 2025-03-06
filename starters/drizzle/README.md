# Starter with Drizzle

This starter makes it easy to start up a project with database using Drizzle.

Create your new project:

```shell
npx degit redwoodjs/sdk/starters/drizzle my-project-name
cd my-project-name
pnpm install
```

Within your project's `wrangler.toml` file, replace the placeholder values. For example:

```toml
name = "my-project-name"
main = "src/worker.tsx"
compatibility_date = "2024-09-23"
compatibility_flags = ["nodejs_compat"]

[[ d1_databases ]]
binding = "DB"
database_name = "my-project-db"
database_id = "YOUR-DB-ID-HERE"
migrations_dir = "drizzle"
```

You'll need a [Cloudflare account](https://www.cloudflare.com/) as this starter uses Cloudflare D1 for the database.

Create a new D1 database:

```shell
npx wrangler d1 create my-project-db
```

![New Database](./public/images/new-db.png)

Copy the `database_id` from the output and paste it into:

1. Your project's `wrangler.toml` file
2. The `.env` file (copy from `.env.example`)

```text
CLOUDFLARE_ACCOUNT_ID=your-account-id
CLOUDFLARE_DATABASE_ID=your-database-id
CLOUDFLARE_D1_TOKEN=your-api-token
```

To get your Cloudflare credentials:

- **Account ID**: Find this under Workers & Pages in your Cloudflare dashboard
- **API Token**: Generate this under User Profile > API Tokens with the following permissions:
  - Account Settings: Read
  - D1: Edit

The starter includes a basic user model in `src/db/schema.ts`:

```typescript
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});
```

Set up your database:

```shell
pnpm migrate:new
pnpm migrate:dev
pnpm seed
```

These commands will:

- Create your initial migration
- Apply the migration to your database
- Seed your database with initial data

Start your development server:

```shell
pnpm dev
```

You should see your seeded data displayed in the browser.

### Database Changes

When you need to make changes to your database schema:

1. Update your schema in `src/db/schema.ts`
2. Run `pnpm migrate:new` to create a new migration
3. Run `pnpm migrate:dev` to apply the migration

### Recommended Tools

VS Code extensions that make development easier:

- [SQLite Viewer](https://marketplace.cursorapi.com/items?itemName=qwtel.sqlite-viewer)
- [Better SQLite](https://marketplace.visualstudio.com/items?itemName=bettersqlite.better-sqlite3)

For database management, we recommend [Bee Keeper Studio](https://www.beekeeperstudio.io/).

## Further Reading

- [Drizzle Documentation](https://orm.drizzle.team)
- [Cloudflare D1 Documentation](https://developers.cloudflare.com/d1)
