import { defineApp } from "rwsdk/worker";
import { render } from "rwsdk/router";

import { Document } from "@/app/Document";
import router from "@/app/router";
import { setCommonHeaders } from "@/app/headers";

export type AppContext = {};

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  render(Document, router),
]);
