import { defineApp } from "@redwoodjs/sdk/worker";
import { index, render } from "@redwoodjs/sdk/router";
import { Document } from "src/Document";
import { Home } from "src/pages/Home";
import { setupDb } from "./db";
import { setCommonHeaders } from "src/headers";
type AppContext = {};

export default defineApp<AppContext>([
  setCommonHeaders(),
  async ({ ctx, env, request }) => {
    await setupDb(env);
  },
  render(Document, [index([Home])]),
]);
