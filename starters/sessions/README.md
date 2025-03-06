# Sessions Starter

This starter gives you a RedwoodJS project with built-in session management.

Create your new project:

```shell
npx degit redwoodjs/sdk/starters/sessions my-project-name
cd my-project-name
pnpm install
```

Within your project's `wrangler.toml` file, replace the placeholder values. For example:

```toml
#:schema node_modules/wrangler/config-schema.json
name = "my-project-name"
main = "src/worker.tsx"
compatibility_date = "2024-09-23"
compatibility_flags = ["nodejs_compat"]
assets = { binding = "ASSETS", directory = "public" }

workers_dev = false
routes = [
  { pattern = "my-project-name.example.com", custom_domain = true }
]

[observability]
enabled = true

[[migrations]]
tag = "v1"
new_classes = ["SessionDO"]

[vars]
SECRET_KEY = "SECRET_KEY_FOR_LOCAL_DEVELOPMENT"
APP_URL = "https://my-project-name.example.com"
```

For deployments, make use of [cloudflare secrets](https://developers.cloudflare.com/workers/configuration/secrets/) for the `SECRET_KEY`.

Start your development server:

```shell
pnpm dev
```

## Further Reading

- [RedwoodJS Documentation](https://redwoodjs.com)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers)
