import type * as PageTree from "fumadocs-core/page-tree";
import type { InferPageType } from "fumadocs-core/source";
import { pageTree } from "@/app/sidebar";
import { source } from "@/lib/source";

type Page = InferPageType<typeof source>;

function collectUrls(nodes: PageTree.Node[]): string[] {
  const urls: string[] = [];
  for (const node of nodes) {
    if (node.type === "page") {
      urls.push(node.url);
    } else if (node.type === "folder") {
      urls.push(...collectUrls(node.children));
    }
  }
  return urls;
}

function getLastModified(url: string): string | undefined {
  const slugs = url === "/" ? [] : url.split("/").filter(Boolean);
  const page = source.getPage(slugs);
  if (!page) return undefined;
  const lastModified = (page.data as Page["data"] & { lastModified?: Date })
    .lastModified;
  if (!(lastModified instanceof Date)) return undefined;
  return lastModified.toISOString().split("T")[0];
}

export function generateSitemap(origin: string): string {
  const urls = ["/", ...collectUrls(pageTree.children)];

  const entries = urls
    .map((url) => {
      const loc = `${origin}${url.replace(/\/?$/, "/")}`;
      const lastmod = getLastModified(url);
      return [
        "  <url>",
        `    <loc>${loc}</loc>`,
        lastmod ? `    <lastmod>${lastmod}</lastmod>` : null,
        "  </url>",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>`;
}
