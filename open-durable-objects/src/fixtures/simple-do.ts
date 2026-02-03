import { OpenDurableObject } from "../durable-object/index.js";

export class SimpleDO extends OpenDurableObject {
  async fetch(request: Request) {
      const url = new URL(request.url);
      if (url.pathname === "/sayHello") {
           const args = await request.json() as string[];
           const result = await this.sayHello(args[0]);
           return new Response(JSON.stringify(result));
      }
      return new Response("Not Found", { status: 404 });
  }

  async sayHello(name: string) {
    return `Hello, ${name} from ${this.constructor.name}`;
  }
}
