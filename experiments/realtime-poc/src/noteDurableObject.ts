import { DurableObject } from "cloudflare:workers";

export class NoteDurableObject extends DurableObject {
  private state: DurableObjectState;
  private content: string | undefined;

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    this.state = state;
    this.content = undefined;
  }

  async getContent(): Promise<string> {
    return (this.content ??=
      (await this.state.storage.get<string>("content")) ?? "");
  }

  async setContent(newContent: string): Promise<void> {
    this.content = newContent;
    await this.state.storage.put<string>("content", this.content);
  }
}
