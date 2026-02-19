import type * as PageTree from "fumadocs-core/page-tree";
import { pageTree } from "@/app/sidebar";

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

export function generateSitemap(origin: string): string {
  const urls = ["/", ...collectUrls(pageTree.children)];

  const entries = urls
    .map(
      (url) =>
        `  <url>\n    <loc>${origin}${url.replace(/\/?$/, "/")}</loc>\n  </url>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>`;
}
