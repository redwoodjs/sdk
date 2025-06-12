import { defineApp, type RequestInfo } from "rwsdk/worker";
import { render, route } from "rwsdk/router";

import { Document } from "@/app/Document";
import { Home } from "@/app/pages/Home";
import { setCommonHeaders } from "@/app/headers";

export type AppContext = {
  dog: string,
};

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here

  },
  render(Document, [
    route('/', Home)
  ])
]);
