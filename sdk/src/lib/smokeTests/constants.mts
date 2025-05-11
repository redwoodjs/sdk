import debug from "debug";

// Configure debug logger
if (!process.env.DEBUG) {
  debug.enable("rwsdk:smoke");
}

export const log = debug("rwsdk:smoke");
export const TIMEOUT = 30000; // 30 seconds timeout
export const RETRIES = 3;

// Known Cloudflare account ID - default to RedwoodJS account if we need one
export const REDWOODJS_ACCOUNT_ID = "1634a8e653b2ce7e0f7a23cca8cbd86a";
