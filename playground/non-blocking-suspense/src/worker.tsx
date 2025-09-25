import { defineApp } from "rwsdk/worker";
import { render, route } from "rwsdk/router";

import { Document } from "@/app/Document";
import { Home } from "@/app/pages/Home";
import { setCommonHeaders } from "@/app/headers";
import {
  deferExampleRemoteRequest,
  resolveExampleRemoteRequest,
} from "@/app/lib/exampleRemoteRequest";

export type AppContext = {};

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  render(Document, [route("/", Home)]),
  route("/defer-response", async () => {
    deferExampleRemoteRequest();
    return new Response("Response set");
  }),
  route("/resolve-response", async ({ request }) => {
    resolveExampleRemoteRequest(await request.text());
    return new Response("Response set");
  }),
]);
