import { DurableObjectNamespace } from "cloudflare:workers";
declare namespace Cloudflare {
  interface Env {
    WEBAUTHN_RP_ID: string;
    WEBAUTHN_APP_NAME: string;
    WEBAUTHN_RP_NAME: string;
    PASSKEY_DURABLE_OBJECT: DurableObjectNamespace;
    SESSION_DURABLE_OBJECT: DurableObjectNamespace;
  }
}
