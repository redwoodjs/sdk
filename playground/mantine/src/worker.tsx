import { layout, render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

import { Document } from "@/app/Document";
import { setCommonHeaders } from "@/app/headers";
import { MantineLayout } from "@/app/layouts/MantineLayout.mjs";
import { Home } from "@/app/pages/Home";

export type AppContext = {};

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  render(Document, [layout(MantineLayout, [route("/", Home)])]),
]);
