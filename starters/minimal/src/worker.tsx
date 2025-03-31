import { defineApp } from "@redwoodjs/sdk/worker";
import { index, render } from "@redwoodjs/sdk/router";
import { Document } from "src/Document";
import { Home } from "src/pages/Home";
import { setCommonHeaders } from "src/headers";

type AppContext = {};

export default defineApp<AppContext>([
  setCommonHeaders(),
  ({ appContext }) => {
    // setup appContext here
    appContext;
  },
  render(Document, [index([Home])]),
]);
