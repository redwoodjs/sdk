import { defineApp } from "@redwoodjs/sdk/worker";
import { index, render } from "@redwoodjs/sdk/router";

import { Document } from "@/Document";
import { Home } from "@/pages/Home";
import { setCommonHeaders } from "@/headers";

type AppContext = {};

export default defineApp<AppContext>([
  setCommonHeaders(),
  ({ appContext }) => {
    // setup appContext here
    appContext;
  },
  render(Document, [index([Home])]),
]);
