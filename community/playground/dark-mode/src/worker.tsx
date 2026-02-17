import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

import { Document } from "@/app/Document";
import { Home } from "@/app/pages/Home";

export interface AppContext {
  theme?: "dark" | "light" | "system";
}

export default defineApp([
  ({ ctx, request }) => {
    // Read theme from cookie
    const cookie = request.headers.get("Cookie");
    const match = cookie?.match(/theme=([^;]+)/);
    ctx.theme = (match?.[1] as "dark" | "light" | "system") || "system";
  },
  render(Document, [route("/", Home)]),
]);

