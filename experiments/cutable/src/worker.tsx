import { defineApp } from "@redwoodjs/sdk/worker";
import { index, render } from "@redwoodjs/sdk/router";
import { Document } from "src/Document";
import HomePage from "src/pages/home/HomePage";

export { SessionDO } from "./session";

type AppContext = {
  foo: number;
};

export default defineApp<AppContext>([
  // >>> Replaces `getContext()`
  ({ appContext }: { appContext: AppContext }) => {
    // >>> You can do side effects (e.g, setup like `setupDb()`) here
    // >>> You can set your context here
    appContext.foo = 23;
  },
  // @ts-ignore
  render(Document, [index([HomePage])]),
]);
