import { env } from "cloudflare:workers";
import { defineDurableSession } from "rwsdk/auth";

export let sessions = defineDurableSession({
  sessionDurableObject: env.SESSION_DURABLE_OBJECT,
});
