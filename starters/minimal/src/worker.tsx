import { defineApp } from "@redwoodjs/sdk/worker";
import { route, render } from "@redwoodjs/sdk/router";
import { requestContext } from "@redwoodjs/sdk/worker";

import { Document } from "@/app/Document";
import { Home } from "@/app/pages/Home";
import { setCommonHeaders } from "@/app/headers";

export default defineApp([
  setCommonHeaders(),
  () => {
    // setup data here
    requestContext.data;
  },
  render(Document, [route("/", Home)]),
]);
