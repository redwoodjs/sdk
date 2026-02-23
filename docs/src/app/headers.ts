import { RouteMiddleware } from "rwsdk/router";

export const setCommonHeaders =
  (): RouteMiddleware =>
  ({ response, rw: { nonce } }) => {
    if (!import.meta.env.VITE_IS_DEV_SERVER) {
      response.headers.set(
        "Strict-Transport-Security",
        "max-age=63072000; includeSubDomains; preload",
      );
    }

    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("X-Frame-Options", "DENY");
    response.headers.set(
      "Referrer-Policy",
      "strict-origin-when-cross-origin",
    );
    response.headers.set(
      "Permissions-Policy",
      "geolocation=(), microphone=(), camera=()",
    );
    response.headers.set(
      "Content-Security-Policy",
      `default-src 'self'; script-src 'self' 'nonce-${nonce}' https://scripts.simpleanalyticscdn.com; style-src 'self' 'unsafe-inline'; frame-src 'self' https://www.youtube.com; frame-ancestors 'self'; object-src 'none'; img-src 'self' data: https://imagedelivery.net https://queue.simpleanalyticscdn.com; connect-src 'self' https://queue.simpleanalyticscdn.com;`,
    );
  };
