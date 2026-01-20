import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

import { Document } from "@/app/Document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/Home";
import { handleTestRequest } from "./lib/test-bridge";
import * as actions from "./tests/action/action";

export type AppContext = {};

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  route("/_test", {
    post: ({ request }) => handleTestRequest(request, actions),
  }),
  render(Document, [route("/", Home)]),
]);