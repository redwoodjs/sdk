import { defineApp } from '@redwoodjs/reloaded/worker';
import { index, prefix } from '@redwoodjs/reloaded/router';
import { authRoutes } from "src/pages/auth/routes";
import { Head } from 'src/Head';
import HomePage from 'src/pages/Home/HomePage';
export { SessionDO } from "./session";

export const getContext = async (
  request: Request,
  env: Env,
) => {
  return {
    user: null,
    YT_API_KEY: env.YT_API_KEY,
  };
};


const routes = [
  index([
    HomePage,
  ]),
  ...prefix("/user", authRoutes),
]

export default defineApp<ReturnType<typeof getContext>>({
  Head,
  getContext,
  routes,
})