import { defineApp } from "rwsdk/worker";
import { except, layout, render, route } from "rwsdk/router";

import { Document } from "@/app/Document";
import { DocPageView } from "@/app/pages/DocPage";
import { DocsLayoutWrapper } from "@/app/layouts/DocsLayoutWrapper";
import { setCommonHeaders } from "@/app/headers";

export interface AppContext {
  theme?: "dark" | "light" | "system";
}

export default defineApp([
  setCommonHeaders(),
  ({ ctx, request }) => {
    const cookie = request.headers.get("Cookie");
    const match = cookie?.match(/theme=([^;]+)/);
    ctx.theme = (match?.[1] as "dark" | "light" | "system") || "system";
  },
  except((error) => {
    console.error("Server error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }),
  render(
    Document,
    layout(DocsLayoutWrapper, [
      route("/", () => <DocPageView slug="index" />),
      route("/*", ({ params }) => <DocPageView slug={params.$0} />),
    ]),
  ),
]);
