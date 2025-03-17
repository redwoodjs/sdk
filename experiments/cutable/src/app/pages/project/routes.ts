import { index, route } from "redwoodsdk/router";
import ProjectListPage from "./ListPage/ProjectListPage";
import ProjectDetailPage from "./DetailPage/ProjectDetailPage";
import CutlistDetailPage from "./DetailPage/CutlistDetailPage";
export const projectRoutes = [
  index(function () {
    // redirect to invoice/list
    return new Response(null, {
      status: 301,
      headers: {
        Location: "/project/list",
      },
    });
  }),
  route("/list", ProjectListPage),
  route("/:id", ProjectDetailPage),
  route("/:id/detail", CutlistDetailPage),
];
