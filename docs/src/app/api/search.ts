import { create, insertMultiple, search } from "@orama/orama";
import { pluginQPS } from "@orama/plugin-qps";
import { source } from "@/lib/source";

// Build the Orama index at module scope from all doc pages.
// Uses QPS (Quantum Proximity Scoring) instead of the default BM25 algorithm.
// QPS ranks results by how close matching tokens appear to each other,
// which is ideal for short doc searches. It also produces a smaller index than BM25.
const db = create({
  schema: {
    title: "string",
    content: "string",
    url: "string",
    type: "string",
    pageTitle: "string",
  },
  plugins: [pluginQPS()],
});

const entries: Array<{
  title: string;
  content: string;
  url: string;
  type: string;
  pageTitle: string;
}> = [];

for (const page of source.getPages()) {
  const { title, description } = page.data;
  const pageData = page.data as unknown as Record<string, unknown>;

  // Get structuredData — may be direct or behind load()
  let structuredData: {
    headings?: Array<{ id: string; content: string }>;
    contents?: Array<{ heading?: string; content: string }>;
  } | undefined;

  if ("structuredData" in pageData) {
    structuredData = pageData.structuredData as typeof structuredData;
  } else if (
    "load" in pageData &&
    typeof pageData.load === "function"
  ) {
    const loaded = await (pageData.load as () => Promise<Record<string, unknown>>)();
    structuredData = loaded.structuredData as typeof structuredData;
  }

  // Page-level entry
  entries.push({
    title: title ?? "",
    content: description ?? "",
    url: page.url,
    type: "page",
    pageTitle: title ?? "",
  });

  // Build heading id → text map for resolving content block headings
  const headingMap = new Map<string, string>();
  for (const heading of structuredData?.headings ?? []) {
    headingMap.set(heading.id, heading.content);
    entries.push({
      title: heading.content,
      content: heading.content,
      url: `${page.url}#${heading.id}`,
      type: "heading",
      pageTitle: title ?? "",
    });
  }

  // Content block entries
  for (const block of structuredData?.contents ?? []) {
    const headingText = block.heading ? (headingMap.get(block.heading) ?? block.heading) : (title ?? "");
    entries.push({
      title: headingText,
      content: block.content,
      url: block.heading ? `${page.url}#${block.heading}` : page.url,
      type: "text",
      pageTitle: title ?? "",
    });
  }
}

insertMultiple(db, entries);

const textEntries = entries.filter(e => e.type === "text").length;
const headingEntries = entries.filter(e => e.type === "heading").length;
const pageEntries = entries.filter(e => e.type === "page").length;
console.log(`[search] Indexed ${entries.length} entries: ${pageEntries} pages, ${headingEntries} headings, ${textEntries} text blocks`);

// GET handler: /api/search?query=...
export function handleSearch(request: Request): Response {
  const url = new URL(request.url);
  const query = url.searchParams.get("query") ?? "";

  if (!query) {
    return Response.json([]);
  }

  const results = search(db, {
    term: query,
    properties: ["title", "content"],
    boost: { title: 2, content: 1.5 },
    tolerance: 1,
    limit: 20,
  });

  const hits = (results as { hits: Array<{ id: string; document: Record<string, string> }> }).hits;

  return Response.json(
    (results as { hits: Array<{ id: string; document: Record<string, string> }> }).hits.map(
      (hit) => ({
        id: hit.id,
        url: hit.document.url,
        type: hit.document.type,
        content: hit.document.type === "text"
          ? (hit.document.content.length > 120
            ? hit.document.content.slice(0, 120) + "..."
            : hit.document.content)
          : hit.document.title,
        heading: hit.document.type === "text" ? hit.document.title : undefined,
        pageTitle: hit.document.pageTitle,
      }),
    ),
  );
}
