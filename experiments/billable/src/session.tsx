import { DurableObject } from "cloudflare:workers";
import { MAX_TOKEN_DURATION } from './constants';
import { ErrorResponse } from './error';

interface Session {
  userId: string;
  createdAt: number
}

export class SessionDO extends DurableObject {
  session: Session | undefined = undefined;
  constructor(public state: DurableObjectState, public env: Env) {
    super(state, env);
    this.session = undefined;
  }

  async saveSession(userId: string): Promise<Session> {
    const session: Session = {
      userId,
      createdAt: Date.now(),
    }

    await this.state.storage.put<Session>("session", session);
    this.session = session;
    return session;
  }

  async getSession(): Promise<Session> {
    if (this.session) {
      return this.session;
    }

    const session = await this.state.storage.get<Session>("session");

    // context(justinvdm, 2025-01-15): If the session DO exists but there's no session state
    // it means we received a valid session id (it passed the signature check), but the session
    // has been revoked.
    if (!session) {
      throw new ErrorResponse(401, "Invalid session");
    }

    // context(justinvdm, 2025-01-15): If the session is expired, we need to revoke it.
    if (session.createdAt + MAX_TOKEN_DURATION < Date.now()) {
      await this.revokeSession();
      throw new ErrorResponse(401, "Session expired");
    }

    this.session = session;
    return session;
  }

  async revokeSession() {
    await this.state.storage.delete("session");
    this.session = undefined;
  }
}
