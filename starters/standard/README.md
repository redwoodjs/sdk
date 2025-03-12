# Standard RedwoodJS Starter

This starter provides a comprehensive RedwoodJS-based implementation that includes passkey authentication using WebAuthn, session management, database integration with Prisma, and file storage with Cloudflare R2. It serves as a fully integrated starting point for Redwood apps, consolidating various essential features into one package.

Create your new project:

```shell
npx degit redwoodjs/sdk/starters/standard my-project-name
cd my-project-name
pnpm install
```

## Configuration

### Wrangler Setup

Within your project's `wrangler.jsonc`:

- Create a new D1 database:

```shell
npx wrangler d1 create my-project-db
```

Copy the database ID provided and paste it into your project's `wrangler.jsonc` file:

```jsonc
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "my-project-db",
      "database_id": "your-database-id",
    },
  ],
}
```

### Setting up Cloudflare Turnstile (Bot Protection)

1. Visit [Cloudflare Turnstile Dashboard](https://dash.cloudflare.com/?to=/:account/turnstile).

2. Create a new Turnstile widget:

   - Set **Widget Mode** to the preferred mode.
   - Add your application's hostname to **Allowed hostnames**, e.g., `my-project-name.example.com`.

3. Copy your **Site Key** into your application's `LoginPage.tsx`:

```tsx
// LoginPage.tsx
const TURNSTILE_SITE_KEY = "<YOUR_SITE_KEY>";
```

4. Set your **Turnstile Secret Key** via Cloudflare secrets for production:

```shell
wrangler secret put TURNSTILE_SECRET_KEY
```

For **local development**, set this secret key in a `.env` file in your project root:

```env
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
```

(Your development environment automatically uses a test site key provided by the framework.)

## Important Security Considerations

### Username vs Email

This starter intentionally uses usernames instead of emails. This decision prevents enumeration attacks and avoids requiring valid email addresses for registration.

### Authentication Flow

Authentication uses credential IDs from the authenticator instead of usernames or emails, significantly mitigating enumeration risks.

## Bot Protection

Registration is protected using [Cloudflare Turnstile](https://www.cloudflare.com/application-services/products/turnstile/) to prevent automated bot registrations - while Cloudflare's built in bot detection will identify and block malicious patterns over time, Turnstile provides immediate verification before registration to prevent bot registrations from the start.

## Further Reading

- [RedwoodJS Documentation](https://redwoodjs.com)
- [Cloudflare Workers Secrets](https://developers.cloudflare.com/workers/runtime-apis/secrets/)
- [Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/)
