import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

import { Document } from "@/app/Document";
import { setCommonHeaders } from "@/app/headers";
import { BlogPost } from "@/app/pages/BlogPost";
import { FileViewer } from "@/app/pages/FileViewer";
import { Home } from "@/app/pages/Home";
import { UserProfile } from "@/app/pages/UserProfile";

export type AppContext = {};

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  render(Document, [
    route("/", Home),
    route("/users/:id", UserProfile),
    route("/files/*", FileViewer),
    route("/blog/:year/:slug", BlogPost),
  ]),
]);


