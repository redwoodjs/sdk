import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

import { AdminDocument, HomeDocument } from "@/app/Document";
import { AdminDetailsPage } from "@/app/pages/AdminDetailsPage";
import { AdminPage } from "@/app/pages/AdminPage";
import { HomePage } from "@/app/pages/HomePage";

export type AppContext = {};

export default defineApp([
  render(HomeDocument, [route("/", HomePage)]),
  render(AdminDocument, [
    route("/admin", AdminPage),
    route("/admin/details", AdminDetailsPage),
  ]),
]);
