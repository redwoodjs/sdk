import { env } from "cloudflare:workers";
import { sessionStore as rwsdkSessionStore } from "rwsdk/runtime";
import type { SessionStore } from "rwsdk/runtime";
import { SessionDurableObject } from "./durableObject";

export const sessionStore: SessionStore = rwsdkSessionStore(
  (env as CloudflareEnv).SESSION_DURABLE_OBJECT,
);
