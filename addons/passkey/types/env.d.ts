declare namespace Cloudflare {
  // note: These types should not be copied!
  // `wrangler types` will generate the correct types for you.
  interface Env {
    WEBAUTHN_RP_ID: string;
    WEBAUTHN_APP_NAME: string;
    PASSKEY_DURABLE_OBJECT: any;
    SESSION_DURABLE_OBJECT: any;
  }
}
