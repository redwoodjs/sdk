import { index, route } from "../../../lib/router";
import ProjectListPage from "./ListPage/ProjectListPage";
import ProjectDetailPage from "./DetailPage/ProjectDetailPage";
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
];
