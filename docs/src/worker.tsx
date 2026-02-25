import { except, layout, render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

import { handleSearch } from "@/app/api/search";
import { Document } from "@/app/Document";
import { setCommonHeaders } from "@/app/headers";
import { DocsLayoutWrapper } from "@/app/layouts/DocsLayoutWrapper";
import { generateLlmsFullTxt, generateLlmsTxt } from "@/app/llms";
import { DocPageView } from "@/app/pages/DocPage";
import { generateSitemap } from "@/app/sitemap";

export interface AppContext {
  theme?: "dark" | "light" | "system";
}

export default defineApp([
  setCommonHeaders(),
  ({ ctx, request }) => {
    const cookie = request.headers.get("Cookie");
    const match = cookie?.match(/theme=([^;]+)/);
    ctx.theme = (match?.[1] as "dark" | "light" | "system") || "system";

    // Chrome 93+ sends Sec-CH-Prefers-Color-Scheme when we opt in via Accept-CH.
    // Resolve "system" to the actual preference so we can set the class in SSR.
    if (ctx.theme === "system") {
      const hint = request.headers.get("Sec-CH-Prefers-Color-Scheme")?.trim();
      if (hint === "dark" || hint === "light") {
        ctx.theme = hint;
      }
    }
  },
  except((error) => {
    console.error("Server error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }),
  route("/sitemap.xml", ({ request }) => {
    const origin = new URL(request.url).origin;
    return new Response(generateSitemap(origin), {
      headers: { "Content-Type": "application/xml" },
    });
  }),
  route("/llms.txt", ({ request }) => {
    const origin = new URL(request.url).origin;
    return new Response(generateLlmsTxt(origin), {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }),
  route("/llms-full.txt", async ({ request }) => {
    const origin = new URL(request.url).origin;
    return new Response(await generateLlmsFullTxt(origin), {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }),
  route("/api/search", ({ request }) => handleSearch(request)),
  render(
    Document,
    layout(DocsLayoutWrapper, [
      route("/", () => <DocPageView slug="index" />),
      route("/*", ({ params }) => <DocPageView slug={params.$0} />),
    ]),
  ),
]);
