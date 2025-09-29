import type { Session } from "../session/durableObject";

declare module "rwsdk/worker" {
  interface DefaultAppContext {
    session: Session | null;
  }
}
