import { readFileSync, existsSync, globSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { remark } from "remark";
import remarkMdx from "remark-mdx";
import { visit } from "unist-util-visit";

const __dirname = dirname(fileURLToPath(import.meta.url));
const docsRoot = resolve(__dirname, "../../..");
const contentDir = resolve(docsRoot, "src/content/docs");

/**
 * Parse MDX content and extract internal links from the AST.
 * This naturally ignores links inside code blocks and inline code.
 */
function extractInternalLinks(content: string): string[] {
  const tree = remark().use(remarkMdx).parse(content);
  const links: string[] = [];

  visit(tree, (node: any) => {
    // Markdown links: [text](/path)
    if (node.type === "link" && typeof node.url === "string") {
      links.push(node.url);
    }

    // JSX elements: <a href="/path"> or <Link href="/path">
    if (
      node.type === "mdxJsxFlowElement" ||
      node.type === "mdxJsxTextElement"
    ) {
      const href = node.attributes?.find(
        (a: any) => a.type === "mdxJsxAttribute" && a.name === "href",
      );
      if (href && typeof href.value === "string") {
        links.push(href.value);
      }
    }
  });

  return links;
}

function isExternalOrSpecial(link: string): boolean {
  return (
    link.startsWith("https://") ||
    link.startsWith("http://") ||
    link.startsWith("#") ||
    link.startsWith("mailto:")
  );
}

/** Strip fragment and trailing slash, then resolve to a content file. */
function resolveLink(link: string): string | null {
  const withoutFragment = link.split("#")[0];
  const normalized = withoutFragment.replace(/^\//, "").replace(/\/$/, "");
  if (!normalized) return null;

  const mdxPath = resolve(contentDir, `${normalized}.mdx`);
  if (existsSync(mdxPath)) return mdxPath;

  const indexPath = resolve(contentDir, normalized, "index.mdx");
  if (existsSync(indexPath)) return indexPath;

  return null;
}

describe("link validation", () => {
  it("all sidebar entries point to existing content files", () => {
    const sidebarPath = resolve(docsRoot, "src/app/sidebar.ts");
    const sidebarContent = readFileSync(sidebarPath, "utf-8");

    // Extract slug strings from sidebar p("Name", "slug") calls
    const slugRegex = /p\(\s*"[^"]*"\s*,\s*"([^"]+)"\s*\)/g;
    const missing: string[] = [];
    let match;

    while ((match = slugRegex.exec(sidebarContent)) !== null) {
      const slug = match[1];
      const mdxPath = resolve(contentDir, `${slug}.mdx`);
      const indexPath = resolve(contentDir, slug, "index.mdx");

      if (!existsSync(mdxPath) && !existsSync(indexPath)) {
        missing.push(slug);
      }
    }

    if (missing.length > 0) {
      expect.fail(
        `Sidebar references ${missing.length} missing content file(s):\n` +
          missing.map((s) => `  - ${s} (expected ${s}.mdx)`).join("\n"),
      );
    }
  });

  it("internal links in MDX files point to existing content", () => {
    const mdxFiles = globSync("**/*.mdx", { cwd: contentDir });
    const broken: Array<{ file: string; link: string }> = [];

    for (const file of mdxFiles) {
      const fullPath = resolve(contentDir, file);
      const content = readFileSync(fullPath, "utf-8");
      const links = extractInternalLinks(content);

      for (const link of links) {
        if (isExternalOrSpecial(link)) continue;
        if (!link.startsWith("/")) continue;
        if (link === "/") continue;

        if (!resolveLink(link)) {
          broken.push({ file, link });
        }
      }
    }

    if (broken.length > 0) {
      const details = broken
        .map((b) => `  - ${b.file} → ${b.link}`)
        .join("\n");
      expect.fail(
        `Found ${broken.length} broken internal link(s):\n${details}`,
      );
    }
  });
});
