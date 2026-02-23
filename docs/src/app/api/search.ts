import { create, insertMultiple, search } from "@orama/orama";
import { source } from "@/lib/source";

// Build the Orama index at module scope from all doc pages
const db = create({
  schema: {
    title: "string",
    content: "string",
    url: "string",
    type: "string",
    pageTitle: "string",
  },
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

  // Heading entries
  for (const heading of structuredData?.headings ?? []) {
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
    entries.push({
      title: block.heading ?? title ?? "",
      content: block.content,
      url: block.heading ? `${page.url}#${block.heading}` : page.url,
      type: "text",
      pageTitle: title ?? "",
    });
  }
}

insertMultiple(db, entries);

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
    boost: { title: 3 },
    tolerance: 1,
    limit: 20,
  });

  return Response.json(
    (results as { hits: Array<{ id: string; document: Record<string, string> }> }).hits.map(
      (hit) => ({
        id: hit.id,
        url: hit.document.url,
        type: hit.document.type,
        content: hit.document.title,
        pageTitle: hit.document.pageTitle,
      }),
    ),
  );
}
