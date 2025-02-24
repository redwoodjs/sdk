# Starter with Drizzle

This starter will make it easy to start up a project with a database using Drizzle.

Clone the repo

```bash
git clone https://github.com/redwoodjs/sdk.git
```

Run

```bash
pnpm install
```

Go into the sdk directory and build the project

```bash
cd sdk
pnpm build
```

Duplicate the `starters/drizzle` directory.

Rename the folder and move it into the `experiments` directory.

Add your new project to the `pnpm-workspace.yaml` file:

```yaml
- "sdk"
  - "experiments/billable"
  - "experiments/yt-dos"
  - "starters/minimal"
  - "starters/prisma"
  - 'experiments/showofhands'
```

👆 Assuming your new project is called `showofhands`

Then, install all the dependencies for your new project:

```bash
pnpm install
```

Generate a d1 database:

```bash
npx wrangler d1 create NAME_OF_DB
```

![New Database](./public/images/new-db.png)

Take the `database_name` and `database_id` and update the values within the `wrangler.toml` file.

```toml
name = "__change_me__"

...

[[ d1_databases ]]
binding = "DB"
database_name = "__change_me__"
database_id = "__change_me__"
migrations_dir = "drizzle"
```

Rename `.env.example` to `.env`

```text
CLOUDFLARE_ACCOUNT_ID=__change_me__
CLOUDFLARE_DATABASE_ID=__change_me__
CLOUDFLARE_D1_TOKEN=__change_me__
```

The `CLOUDFLARE_DATABASE_ID` should be the same as the `database_id` in the `wrangler.toml` file. But, you can also access this from your Cloudflare account:

![Database ID](./public/images/database-id.png)

To get the `CLOUDFLARE_ACCOUNT_ID`, you’ll need to login to your Cloudflare account. Under Computer (Workers) > Workers & Pages > you’ll find the `Account ID` in the right sidebar.

![Cloudflare Account ID](./public/images/cloudflare-account-id.png)

You’ll need to generate a `CLOUDFLARE_D1_TOKEN`. Under your User Account (top right), click on Profile. Then, API Tokens in the left sidebar. Under the API Tokens, click on the Create Token button.

![User API Tokens](./public/images/cloudflare-user-api-tokens.png)

Scroll down to the bottom and click on Custom Token.

![Custom Token](./public/images/cloudflare-custom-token.png)

Give your token a name. I called my `D1 Edit` but you do you.

Under **Permissions**, you’ll need to add 2:

- Account, Account Settings, Read
- Account, D1, Edit

![](./public/images/cloudflare-new-token.png)

Then, click Continue to Summary

![](./public/images/cloudflare-token-summary.png)

Click Create Token and copy/paste the value to your .env file.

![](./public/images/cloudflare-copy-token.png)

Change values within the `src/db/seed.ts` file.

```ts
import { defineScript } from "@redwoodjs/sdk/worker";
import { drizzle } from "drizzle-orm/d1";
import { users } from "./schema";

export default defineScript(async ({ env }) => {
  const db = drizzle(env.DB);

  // Insert a user
  await db.insert(users).values({
    name: "__change me__",
    email: "__change me__",
  });

  // Verify the insert by selecting all users
  const result = await db.select().from(users).all();

  console.log("🌱 Finished seeding");

  return Response.json(result);
});
```

Generate a migration. The first time you run this command, it will create a drizzle folder that will contain all your sql migrations.

```bash
pnpm migrate:new
```

Run the migration.

```bash
pnpm migrate:dev
```

Run the seed file.

```bash
pnpm seed
```

Run the dev server.

```bash
pnpm dev
```
