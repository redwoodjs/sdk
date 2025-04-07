import { defineApp } from "@redwoodjs/sdk/worker";
import { index, render } from "@redwoodjs/sdk/router";
import { Document } from "src/Document";
import { Home } from "src/pages/Home";
import { setCommonHeaders } from "src/headers";
import { requestContext } from "@redwoodjs/sdk/worker";

type AppContext = {};

export default defineApp<AppContext>([
  setCommonHeaders(),
  () => {
    // setup data here
    requestContext.data;
  },
  render(Document, [index([Home])]),
]);
