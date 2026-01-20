import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

import { Document } from "@/app/Document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/Home";
import { handleTestRequest } from "./lib/test-bridge";
import * as actions from "./tests/action/action";
import * as bindingActions from "./tests/action/bindings";
import * as appActions from "./app/actions";

export type AppContext = {};

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  route("/_test", {
    post: ({ request }) => handleTestRequest(request, { ...actions, ...bindingActions, ...appActions }),
  }),
  render(Document, [route("/", Home)]),
]);