import { IS_DEV } from "redwoodsdk/constants";

// >>> Replace this with your own Cloudflare Turnstile site key
export const TURNSTILE_SITE_KEY_PRODUCTION = "1x00000000000000000000AA";

export const TURNSTILE_SITE_KEY_DEV = "1x00000000000000000000AA";

export const TURNSTILE_SITE_KEY = IS_DEV
  ? TURNSTILE_SITE_KEY_DEV
  : TURNSTILE_SITE_KEY_PRODUCTION;
