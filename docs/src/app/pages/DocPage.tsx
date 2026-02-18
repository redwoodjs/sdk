import { source } from "@/lib/source";
import { RedwoodProvider } from "@/lib/fumadocs-provider";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import {
  DocsPage,
  DocsBody,
  DocsTitle,
  DocsDescription,
} from "fumadocs-ui/layouts/docs/page";
import defaultMdxComponents from "fumadocs-ui/mdx";
import darkLogoUrl from "@/assets/dark-logo.svg?url";

// Eagerly import all MDX files as React components at build time.
const mdxModules = import.meta.glob("../../content/docs/**/*.mdx", {
  eager: true,
}) as Record<string, { default: React.ComponentType<{ components?: Record<string, React.ComponentType> }> }>;

function getMDXComponent(
  filePath: string,
): React.ComponentType<{ components?: Record<string, React.ComponentType> }> | undefined {
  const key = `../../content/docs/${filePath}`;
  return mdxModules[key]?.default;
}

export function DocPageView({ slug: rawSlug }: { slug: string }) {
  const slug = rawSlug.replace(/\/+$/, "");
  const slugs = slug === "index" ? [] : slug.split("/");
  const page = source.getPage(slugs);
  const tree = source.pageTree;

  if (!page) {
    return (
      <RedwoodProvider>
        <DocsLayout
          tree={tree}
          nav={{
            title: (
              <img src={darkLogoUrl} alt="RedwoodSDK" className="h-6" />
            ),
          }}
          links={[
            {
              icon: "github",
              url: "https://github.com/redwoodjs/sdk",
              text: "GitHub",
            },
          ]}
        >
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
        </DocsLayout>
      </RedwoodProvider>
    );
  }

  const Content = getMDXComponent(page.data.file.path);

  return (
    <RedwoodProvider>
      <DocsLayout
        tree={tree}
        nav={{
          title: (
            <img src={darkLogoUrl} alt="RedwoodSDK" className="h-6" />
          ),
        }}
        links={[
          {
            icon: "github",
            url: "https://github.com/redwoodjs/sdk",
            text: "GitHub",
          },
        ]}
      >
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
      </DocsLayout>
    </RedwoodProvider>
  );
}
