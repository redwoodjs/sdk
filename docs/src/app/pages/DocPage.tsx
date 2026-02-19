import { source } from "@/lib/source";
import {
  DocsPage,
  DocsBody,
  DocsTitle,
  DocsDescription,
  EditOnGitHub,
  PageLastUpdate,
} from "fumadocs-ui/layouts/docs/page";
import defaultMdxComponents from "fumadocs-ui/mdx";

const GITHUB_REPO_URL = "https://github.com/redwoodjs/sdk";

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

  const MDX = page.data.body;
  const editUrl = `${GITHUB_REPO_URL}/blob/main/docs/src/content/docs/${page.path}`;
  const lastModified = (page.data as { lastModified?: Date }).lastModified;

  return (
    <DocsPage
      toc={page.data.toc}
      tableOfContent={{
        enabled: page.data.tableOfContents !== false,
      }}
      tableOfContentPopover={{ enabled: true }}
    >
      <title>{page.data.title} | RedwoodSDK</title>
      {page.data.description && (
        <meta name="description" content={page.data.description} />
      )}
      <DocsTitle>{page.data.title}</DocsTitle>
      {page.data.description && (
        <DocsDescription>{page.data.description}</DocsDescription>
      )}
      <DocsBody>
        <MDX components={{ ...defaultMdxComponents }} />
      </DocsBody>
      <EditOnGitHub href={editUrl} />
      {lastModified && <PageLastUpdate date={lastModified} />}
    </DocsPage>
  );
}
