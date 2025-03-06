# Passkey Authentication Starter

This starter gives you a RedwoodJS project with built-in passkey (WebAuthn) authentication. Passkeys provide password-less authentication using your device's built-in authenticator or services like Google Passkeys or 1Password.

Create your new project:

```shell
npx degit redwoodjs/sdk/starters/passkey-auth my-project-name
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

[[d1_databases]]
binding = "DB"
database_name = "my-project-db"
database_id = "YOUR-DB-ID-HERE"

[[migrations]]
tag = "v1"
new_classes = ["SessionDO"]

[vars]
SECRET_KEY = "your-secret-key-here"
APP_URL = "https://my-project-name.example.com"
```

You'll need a [Cloudflare account](https://www.cloudflare.com/) as this starter uses Cloudflare D1 for the database.

Create a new D1 database:

```shell
npx wrangler d1 create my-project-db
```

Copy the `database_id` from the output and paste it into your project's `wrangler.toml` file.

For deployments, make use of [cloudflare secrets](https://developers.cloudflare.com/workers/runtime-apis/secrets/) for the `SECRET_KEY`.

## Important Security Considerations

### Username vs Email

This starter intentionally uses usernames instead of email addresses for registration. This is because:

1. Using email addresses could expose whether an email is registered with your service (enumeration attack)
2. Multiple registrations with the same email would create trust issues for account recovery
3. Usernames serve as labels for users to identify their accounts in their authenticator

### Authentication Flow

The authentication flow uses credential IDs from the authenticator rather than usernames/emails as the primary identifier. This helps prevent enumeration attacks while maintaining security.

### TODO: Bot Protection

Currently, the registration endpoint needs protection against automated bot registrations. This will be addressed in a future update by adding Cloudflare Turnstile integration.

## Further Reading

- [RedwoodJS Documentation](https://redwoodjs.com)
- [WebAuthn Guide](https://webauthn.guide/)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers)
