import { db } from "../../../db";
import { index, route } from "../../../lib/router";
import SensorDetailPage from "./DetailPage/SensorDetailPage";
import SensorListPage from "./ListPage/SensorListPage";

export const  sensorRoutes = [
  index(function () {
    // redirect to invoice/list
    return new Response(null, {
      status: 301,
      headers: {
        Location: "/sensor/list",
      },
    });
  }),
  route("/list", SensorListPage),
  // route("/:id", SensorDetailPage),
];
