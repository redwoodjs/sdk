interface CloudflareEnv {
  SESSION_DURABLE_OBJECT: DurableObjectNamespace;
  PASSKEY_DURABLE_OBJECT: DurableObjectNamespace;

  WEBAUTHN_RP_ID: string;
  WEBAUTHN_APP_NAME: string;
}
