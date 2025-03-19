# Sessions Starter

This starter gives you a RedwoodJS project with built-in session management.

## Creating your project

```shell
npx degit redwoodjs/sdk/starters/sessions my-project-name
cd my-project-name
pnpm install
```

Within your project's `wrangler.jsonc` file, replace the placeholder values. For example:

## Running the dev server

```shell
pnpm dev
```

Point your browser to the URL displayed in the terminal (e.g. `http://localhost:2332/`).

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
  "migrations": [
    {
      "tag": "v1",
      "new_classes": ["SessionDO"]
    }
  ],
  "vars": {
    "APP_URL": "https://my-project-name.example.com"
  }
}
```

### Setting up Session Secret Key

For production, generate a strong SECRET_KEY for signing session IDs. You can generate a secure random key using OpenSSL:

```shell
# Generate a 32-byte random key and encode it as base64
openssl rand -base64 32
```

Then set this key as a Cloudflare secret:

```shell
wrangler secret put SECRET_KEY
```

For **local development**, set this secret key in a `.env` file in your project root:

```env
SECRET_KEY=your-development-secret-key
```

Never use the same secret key for development and production environments, and avoid committing your secret keys to version control.

## Further Reading

- [RedwoodJS Documentation](https://redwoodjs.com)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers)
