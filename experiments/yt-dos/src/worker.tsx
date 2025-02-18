import { defineApp } from '@redwoodjs/sdk/worker';
import { index, layout } from '@redwoodjs/sdk/router';
import HomePage from 'src/pages/Home/HomePage';
import { Document } from 'src/Document';
export { SessionDO } from "./session";

export type Context = {
  YT_API_KEY: string;
}

export const getContext = (
  env: Env,
): Context => {
  return {
    YT_API_KEY: env.YT_API_KEY as string,
  };
};


export default defineApp<Context>([
  ({ ctx, env }) => {
    Object.assign(ctx, getContext(env));
  },
  layout(Document, [
    index([
      HomePage,
    ]),
  ]),
])