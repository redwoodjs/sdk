import { RouteMiddleware } from "redwoodsdk/router";

export const setCommonHeaders =
  (): RouteMiddleware =>
  ({ headers, rw: { nonce } }) => {
    // Forces browsers to always use HTTPS for a specified time period (2 years)
    headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload",
    );

    // Prevents your site from being embedded in iframes on other domains
    headers.set("X-Frame-Options", "DENY");

    // Forces browser to use the declared content-type instead of trying to guess/sniff it
    headers.set("X-Content-Type-Options", "nosniff");

    // Stops browsers from sending the referring webpage URL in HTTP headers
    headers.set("Referrer-Policy", "no-referrer");

    // Explicitly disables access to specific browser features/APIs
    headers.set(
      "Permissions-Policy",
      "geolocation=(), microphone=(), camera=()",
    );

    // Defines trusted sources for content loading and script execution:
    // - Only loads resources from same origin ('self')
    // - Only runs scripts from same origin
    // - Blocks all plugins/embedded objects
    //
    // Usage:
    // - Add other origins to this list (space separated) if you want to allow them
    // - Add 'nonce=${nonce}' to inline <script> tags you trust
    headers.set(
      "Content-Security-Policy",
      `default-src 'self'; script-src 'self' 'nonce-${nonce}'; object-src 'none';`,
    );
  };
