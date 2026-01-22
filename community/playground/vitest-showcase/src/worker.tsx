import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

import { Document } from "@/app/Document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/Home";
import { handleVitestRequest } from "rwsdk-community/worker";
import * as appActions from "./app/actions";
import * as testUtils from "./app/test-utils";

export type AppContext = {};

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  route("/_test", {
    post: ({ request }) => handleVitestRequest(request, { ...appActions, ...testUtils }),
  }),
  render(Document, [route("/", Home)]),
]);