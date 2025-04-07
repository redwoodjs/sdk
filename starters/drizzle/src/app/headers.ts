import { RouteMiddleware } from "@redwoodjs/sdk/router";
import { IS_DEV } from "@redwoodjs/sdk/constants";
import { requestContext } from "@redwoodjs/sdk/worker";

export const setCommonHeaders = (): RouteMiddleware => () => {
  const {
    headers,
    rw: { nonce },
  } = requestContext;

  if (!IS_DEV) {
    // Forces browsers to always use HTTPS for a specified time period (2 years)
    headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload",
    );
  }

  // Forces browser to use the declared content-type instead of trying to guess/sniff it
  headers.set("X-Content-Type-Options", "nosniff");

  // Stops browsers from sending the referring webpage URL in HTTP headers
  headers.set("Referrer-Policy", "no-referrer");

  // Explicitly disables access to specific browser features/APIs
  headers.set("Permissions-Policy", "geolocation=(), microphone=(), camera=()");

  // Defines trusted sources for content loading and script execution:
  headers.set(
    "Content-Security-Policy",
    `default-src 'self'; script-src 'self' 'nonce-${nonce}' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; frame-src https://challenges.cloudflare.com; object-src 'none';`,
  );
};
