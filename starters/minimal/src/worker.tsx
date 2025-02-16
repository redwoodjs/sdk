import { defineApp } from '@redwoodjs/reloaded/worker';
import { index } from '@redwoodjs/reloaded/router';
import { Document } from 'src/Document';
import { Home } from 'src/pages/Home';

export const getContext = async (
  _request: Request,
  _env: Env,
) => {
  return {};
};


const routes = [
  index([
    Home,
  ]),
]

export default defineApp<ReturnType<typeof getContext>>({
  Document,
  getContext,
  routes,
})