import twilio from "twilio";

// todo(harryhcs, 2024-12-03): Use env variables
const createClient = (env: Env) => twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);

export let client: ReturnType<typeof createClient>;

export const setupTwilioClient = (env: Env) => {
  client = createClient(env);
  return client;
};
