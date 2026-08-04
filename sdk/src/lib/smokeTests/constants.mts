import debug from "debug";

// Configure debug logger
if (!process.env.DEBUG) {
  debug.enable("rwsdk:smoke");
}

export const log = debug("rwsdk:smoke");
export const TIMEOUT = 30000; // 30 seconds timeout
export const RETRIES = 3;

// context(justinvdm, 2026-08-04): Readiness probes that hit the app root
// trigger a full cold SSR render, which can take many seconds inside the
// release container (Linux on macOS — measured ~80s for a cold dev start,
// several seconds per cold render). Three 1-second attempts produced false
// failures there, so probes reuse this budget instead. Mirrors the constant
// of the same name in sdk/src/lib/e2e/dev.mts.
export const DEV_SERVER_CHECK_TIMEOUT = process.env
  .RWSDK_DEV_SERVER_CHECK_TIMEOUT
  ? parseInt(process.env.RWSDK_DEV_SERVER_CHECK_TIMEOUT, 10)
  : 5 * 60 * 1000;

// Known Cloudflare account ID - default to RedwoodJS account if we need one
export const REDWOODJS_ACCOUNT_ID = "1634a8e653b2ce7e0f7a23cca8cbd86a";
