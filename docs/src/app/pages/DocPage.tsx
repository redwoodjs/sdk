import { source } from "@/lib/source";
import {
  DocsPage,
  DocsBody,
  DocsTitle,
  DocsDescription,
} from "fumadocs-ui/layouts/docs/page";
import defaultMdxComponents from "fumadocs-ui/mdx";

// Eagerly import all MDX files as React components at build time.
const mdxModules = import.meta.glob("../../content/docs/**/*.mdx", {
  eager: true,
}) as Record<string, { default: React.ComponentType<{ components?: Record<string, React.ComponentType> }> }>;

function getMDXComponent(
  slugs: string[],
): React.ComponentType<{ components?: Record<string, React.ComponentType> }> | undefined {
  const path = slugs.length === 0 ? "index" : slugs.join("/");
  const key = `../../content/docs/${path}.mdx`;
  return mdxModules[key]?.default;
}

export function DocPageView({ slug: rawSlug }: { slug: string }) {
  const slug = rawSlug.replace(/\/+$/, "");
  const slugs = slug === "index" ? [] : slug.split("/");
  const page = source.getPage(slugs);

  if (!page) {
    return (
      <DocsPage>
        <DocsBody>
          <h1 className="text-3xl font-bold">Not Found</h1>
          <p className="mt-2 text-zinc-400">
            No documentation found for{" "}
            <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-sm">
              {slug}
            </code>
            .
          </p>
        </DocsBody>
      </DocsPage>
    );
  }

  const Content = getMDXComponent(slugs);

  return (
    <DocsPage
      toc={page.data.toc}
      tableOfContent={{
        enabled: page.data.tableOfContents !== false,
      }}
    >
      <DocsTitle>{page.data.title}</DocsTitle>
      {page.data.description && (
        <DocsDescription>{page.data.description}</DocsDescription>
      )}
      <DocsBody>
        {Content ? (
          <Content components={{ ...defaultMdxComponents }} />
        ) : (
          <p>Content not available.</p>
        )}
      </DocsBody>
    </DocsPage>
  );
}
