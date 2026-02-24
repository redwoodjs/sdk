import { source } from "@/lib/source";
import type { InferPageType } from "fumadocs-core/source";
import {
  DocsPage,
  DocsBody,
  DocsTitle,
  DocsDescription,
} from "fumadocs-ui/layouts/docs/page";
import defaultMdxComponents from "fumadocs-ui/mdx";
import { requestInfo } from "rwsdk/worker";


type Page = InferPageType<typeof source>;

export function DocPageView({ slug: rawSlug }: { slug: string }) {
  const slug = rawSlug.replace(/\/+$/, "");
  const slugs = slug === "index" ? [] : slug.split("/");
  const page: Page | undefined = source.getPage(slugs);

  if (!page) {
    requestInfo.response.status = 404;
    return (
      <DocsPage>
        <title>Not Found | RedwoodSDK</title>
        <DocsBody>
          <h1 className="text-3xl font-bold">Not Found</h1>
          <p className="mt-2 text-fd-muted-foreground">
            No documentation found for{" "}
            <code className="rounded bg-fd-muted px-1.5 py-0.5 text-sm">
              {slug}
            </code>
            .
          </p>
        </DocsBody>
      </DocsPage>
    );
  }

  const MDX = page.data.body;
  const pageUrl = `${new URL(requestInfo.request.url).origin}${page.url}`;

  return (
    <DocsPage
      toc={page.data.toc}
      tableOfContent={{
        enabled: page.data.tableOfContents !== false,
      }}
      tableOfContentPopover={{ enabled: true }}
    >
      {/* React 19 hoists <title> and <meta> into <head> automatically */}
      <title>{`${page.data.title} | RedwoodSDK`}</title>
      {page.data.description && (
        <meta name="description" content={page.data.description} />
      )}
      <meta
        property="og:title"
        content={`${page.data.title} | RedwoodSDK`}
      />
      {page.data.description && (
        <meta property="og:description" content={page.data.description} />
      )}
      <meta property="og:url" content={pageUrl} />
      <meta
        name="twitter:title"
        content={`${page.data.title} | RedwoodSDK`}
      />
      {page.data.description && (
        <meta name="twitter:description" content={page.data.description} />
      )}
      <DocsTitle>{page.data.title}</DocsTitle>
      {page.data.description && (
        <DocsDescription>{page.data.description}</DocsDescription>
      )}
      <DocsBody>
        <MDX components={{ ...defaultMdxComponents }} />
      </DocsBody>
    </DocsPage>
  );
}
