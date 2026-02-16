import { allDocs } from "content-collections";
import { Sidebar } from "@/app/components/Sidebar";

// Eagerly import all MDX files as React components at build time.
const mdxModules = import.meta.glob("../../content/docs/**/*.mdx", {
  eager: true,
}) as Record<string, { default: React.ComponentType }>;

// Build a map from content-collections _meta.path → MDX component.
function getMDXComponent(metaPath: string): React.ComponentType | undefined {
  // _meta.path is e.g. "core/routing", glob key is e.g. "../../content/docs/core/routing.mdx"
  const key = `../../content/docs/${metaPath}.mdx`;
  return mdxModules[key]?.default;
}

export function DocPage({ slug: rawSlug }: { slug: string }) {
  // Normalize: strip trailing slashes
  const slug = rawSlug.replace(/\/+$/, "");
  const doc = allDocs.find((d) => d.slug === slug);

  if (!doc) {
    return (
      <div className="grid min-h-screen grid-cols-[17.5rem_1fr]">
        <Sidebar currentSlug={slug} />
        <main className="px-12 py-8 max-w-3xl">
          <h1 className="text-3xl font-bold">Not Found</h1>
          <p className="mt-2 text-zinc-400">
            No documentation found for{" "}
            <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-sm">
              {slug}
            </code>
            .
          </p>
        </main>
      </div>
    );
  }

  const Content = getMDXComponent(doc._meta.path);

  return (
    <div className="grid min-h-screen grid-cols-[17.5rem_1fr]">
      <Sidebar currentSlug={slug} />
      <main className="px-12 py-8 max-w-3xl">
        <h1 className="text-3xl font-bold mb-2">{doc.title}</h1>
        {doc.description && (
          <p className="text-lg text-zinc-400 mb-8 pb-6 border-b border-zinc-800">
            {doc.description}
          </p>
        )}
        <div className="prose prose-invert prose-zinc max-w-none">
          {Content ? <Content /> : <p>Content not available.</p>}
        </div>
      </main>
    </div>
  );
}
