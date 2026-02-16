import { allDocs } from "content-collections";
import { Sidebar } from "@/app/components/Sidebar";

export function DocPage({ slug: rawSlug }: { slug: string }) {
  // Normalize: strip trailing slashes
  const slug = rawSlug.replace(/\/+$/, "");
  const doc = allDocs.find((d) => d.slug === slug);

  if (!doc) {
    return (
      <div className="flex min-h-screen">
        <Sidebar currentSlug={slug} />
        <main className="flex-1 px-12 py-8 max-w-3xl">
          <h1 className="text-3xl font-bold">Not Found</h1>
          <p className="mt-2 text-zinc-400">
            No documentation found for <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-sm">{slug}</code>.
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar currentSlug={slug} />
      <main className="flex-1 px-12 py-8 max-w-3xl">
        <h1 className="text-3xl font-bold mb-2">{doc.title}</h1>
        {doc.description && (
          <p className="text-lg text-zinc-400 mb-8 pb-6 border-b border-zinc-800">
            {doc.description}
          </p>
        )}
        <div
          className="prose prose-invert prose-zinc max-w-none"
          dangerouslySetInnerHTML={{ __html: doc.body }}
        />
      </main>
    </div>
  );
}
