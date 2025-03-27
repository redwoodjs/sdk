import { defineApp } from "@redwoodjs/sdk/worker";
import { index, document } from "@redwoodjs/sdk/router";
import { Document } from "src/Document";
import { Home } from "src/pages/Home";
import { setCommonHeaders } from "src/headers";

type Context = {};

export default defineApp<Context>([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  document(Document, [index([Home])]),
]);
