import { DurableObject } from "cloudflare:workers";

export class SessionDO extends DurableObject {
  constructor(public state: DurableObjectState, public env: Env) {
    super(state, env);
  }

  async cowsay() {
    return 'im a teapot'
  }
}