import { db } from "../../../db";
import { index, route } from "../../../lib/router";
// import CutlistDetailPage from "./DetailPage/CutlistDetailPage";
import CutlistListPage from "./ListPage/ProjectListPage";

export const cutlistRoutes = [
  index(function () {
    // redirect to invoice/list
    return new Response(null, {
      status: 301,
      headers: {
        Location: "/project/list",
      },
    });
  }),
  route("/list", CutlistListPage),
  // route("/:id", CutlistDetailPage),
];
