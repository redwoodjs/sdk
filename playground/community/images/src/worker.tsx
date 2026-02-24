import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

import { Document } from "@/app/Document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/Home";

export type AppContext = {};

export default defineApp([
  setCommonHeaders(),

  // Image transform route: reads ?w= and ?q= params, rewrites path to the
  // static file, and fetches with cf.image options applied.
  route("/_image/*", ({ request }) => {
    const url = new URL(request.url);

    const width = parseInt(url.searchParams.get("w") ?? "800", 10);
    const quality = parseInt(url.searchParams.get("q") ?? "85", 10);

    url.pathname = url.pathname.replace(/^\/_image/, "");
    url.searchParams.delete("w");
    url.searchParams.delete("q");

    return fetch(url.toString(), {
      cf: {
        image: {
          width,
          quality,
          fit: "scale-down",
        },
      },
    } as RequestInit);
  }),

  render(Document, [route("/", Home)]),
]);
