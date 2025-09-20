import { handleRequest } from "@redwoodjs/sdk/worker";
import { routes } from "@redwoodjs/sdk/router";
import * as home from "@/app/pages/Home";

const pages = {
  home,
};

export type AppContext = {};

export default {
  fetch: handleRequest<AppContext>({
    routes: (route) => {
      route("/", pages.home.Home, "home");
    },
    getAppContext: (ctx) => {
      return {};
    },
  }),
};
