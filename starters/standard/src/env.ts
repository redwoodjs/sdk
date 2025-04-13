import { env } from "cloudflare:workers";

// Set development defaults
if (process.env.NODE_ENV === "development") {
  env.WEBAUTHN_APP_NAME = env.WEBAUTHN_APP_NAME || env.name;
  env.AUTH_SECRET_KEY =
    env.AUTH_SECRET_KEY || "development-secret-key-do-not-use-in-production";
}

// If WEBAUTHN_RP_ID is not set, we'll derive it from the request URL in the worker
export const getWebauthnRpId = (request: Request) => {
  return env.WEBAUTHN_RP_ID || new URL(request.url).hostname;
};

// If WEBAUTHN_APP_NAME is not set, we'll use the app name from wrangler.jsonc
export const getWebauthnAppName = () => {
  return env.WEBAUTHN_APP_NAME || "Development App";
};

export { env };
