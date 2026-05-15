import { defineApp } from "rwsdk/worker";
import { render, route } from "rwsdk/router";

import { Document } from "@/app/Document";
//import { Home } from "@/app/pages/Home";
import { setCommonHeaders } from "@/app/headers";
import { SendEmail } from "@/app/pages/SendEmail";

export type AppContext = {};

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  render(Document, [route("/", SendEmail)]),
]);
