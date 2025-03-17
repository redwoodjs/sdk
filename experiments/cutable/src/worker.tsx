import { defineApp } from "redwoodsdk/worker";
import { index, layout } from "redwoodsdk/router";
import { Document } from "src/Document";
import HomePage from "src/pages/home/HomePage";

export { SessionDO } from "./session";

type Context = {
  foo: number;
};

export default defineApp<Context>([
  // >>> Replaces `getContext()`
  ({ ctx }: { ctx: Context }) => {
    // >>> You can do side effects (e.g, setup like `setupDb()`) here
    // >>> You can set your context here
    ctx.foo = 23;
  },
  // @ts-ignore
  layout(Document, [index([HomePage])]),
]);
