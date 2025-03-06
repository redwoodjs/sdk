import { DurableObject } from "cloudflare:workers";
import { MAX_TOKEN_DURATION } from "./constants";

export interface Session {
  userId: string;
  createdAt: number;
}

export class SessionDO extends DurableObject {
  private session: Session | undefined = undefined;
  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    this.session = undefined;
  }

  async saveSession({ userId }: { userId: string }): Promise<Session> {
    const session: Session = {
      userId,
      createdAt: Date.now(),
    };

    await this.ctx.storage.put<Session>("session", session);
    this.session = session;
    return session;
  }

  async getSession(): Promise<{ value: Session } | { error: string }> {
    if (this.session) {
      return { value: this.session };
    }

    const session = await this.ctx.storage.get<Session>("session");

    // context(justinvdm, 2025-01-15): If the session DO exists but there's no session state
    // it means we received a valid session id (it passed the signature check), but the session
    // has been revoked.
    if (!session) {
      return {
        error: "Invalid session",
      };
    }

    // context(justinvdm, 2025-01-15): If the session is expired, we need to revoke it.
    if (session.createdAt + MAX_TOKEN_DURATION < Date.now()) {
      await this.revokeSession();
      return {
        error: "Session expired",
      };
    }

    this.session = session;
    return { value: session };
  }

  async revokeSession() {
    await this.ctx.storage.delete("session");
    this.session = undefined;
  }
}
