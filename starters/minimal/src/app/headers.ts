import { RouteMiddleware } from "rwsdk/router";

export const setCommonHeaders =
  (): RouteMiddleware =>
  ({ response, rw: { nonce } }) => {
    // Forces browser to use the declared content-type instead of trying to guess/sniff it
    response.headers.set("X-Content-Type-Options", "nosniff");

    // Stops browsers from sending the referring webpage URL in HTTP headers
    response.headers.set("Referrer-Policy", "no-referrer");

    // Explicitly disables access to specific browser features/APIs
    response.headers.set(
      "Permissions-Policy",
      "geolocation=(), microphone=(), camera=()",
    );

    // Defines trusted sources for content loading and script execution:
    response.headers.set(
      "Content-Security-Policy",
      `default-src 'self'; script-src 'self' 'nonce-${nonce}' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; frame-ancestors 'self'; frame-src 'self' https://challenges.cloudflare.com; object-src 'none';`,
    );
  };
