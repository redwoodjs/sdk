# Minimal Starter

This starter gives you a bare-bones RedwoodJS project.

Create your new project:

```shell
npx degit redwoodjs/sdk/starters/minimal my-project-name
cd my-project-name
pnpm install
```

## Running the dev server

```shell
pnpm dev
```

Point your browser to the URL displayed in the terminal (e.g. `http://localhost:2332/`). You should see a "Hello World" message in your browser.

##

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
  }
}
```

## Further Reading

- [RedwoodJS Documentation](https://redwoodjs.com)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers)
