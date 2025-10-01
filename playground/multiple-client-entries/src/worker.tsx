import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

import { AdminDocument } from "@/app/AdminDocument";
import { Document } from "@/app/Document";
import { setCommonHeaders } from "@/app/headers";
import { Admin } from "@/app/pages/Admin";
import { Home } from "@/app/pages/Home";

export type AppContext = {};

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  render(Document, [route("/", Home)]),
  render(AdminDocument, [route("/admin", Admin)]),
]);
