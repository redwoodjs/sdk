import { defineApp } from "@redwoodjs/sdk/worker";
import { index, render } from "@redwoodjs/sdk/router";
import { Document } from "@/app/Document";
import { Home } from "@/app/pages/Home";
import { setupDb } from "./db";
import { setCommonHeaders } from "@/app/headers";
import { requestContext } from "@redwoodjs/sdk/worker";
import { env } from "cloudflare:workers";

export type Data = {};

export default defineApp([
  setCommonHeaders(),
  async () => {
    await setupDb(env);
  },
  render(Document, [index([Home])]),
]);
