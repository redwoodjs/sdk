import { defineApp } from "redwoodsdk/worker";
import { index, layout } from "redwoodsdk/router";
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
  layout(Document, [index([Home])]),
]);
