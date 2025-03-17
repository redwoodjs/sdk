import { DurableObject } from "cloudflare:workers";

export class DocumentDurableObject extends DurableObject {
  private state: DurableObjectState;
  private content: string;

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    this.state = state;
    this.content = "";
  }

  async getContent(): Promise<string> {
    return this.content;
  }

  async setContent(newContent: string): Promise<void> {
    this.content = newContent;
    await this.state.storage.put<string>("content", this.content);
  }

  async initialize() {
    const storedContent = await this.state.storage.get<string>("content");
    this.content = storedContent || "";
  }
}
