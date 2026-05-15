import { source } from "@/lib/source";
import type { InferPageType } from "fumadocs-core/source";

type Page = InferPageType<typeof source>;

export function generateLlmsTxt(origin: string): string {
  const pages = source.getPages();

  const lines = [
    "# RedwoodSDK Documentation",
    "",
    `> RedwoodSDK is a React framework for Cloudflare. It starts as a Vite plugin that enables server-side rendering, React Server Components, server functions, streaming responses, and real-time capabilities. Its standards-based router—with support for middleware and interrupters—gives you fine-grained control over every request and response.`,
    "",
    ...pages.map((page) => `- [${page.data.title}](${origin}${page.url})`),
  ];

  return lines.join("\n");
}

export async function generateLlmsFullTxt(origin: string): Promise<string> {
  const pages = source.getPages();

  const sections = await Promise.all(
    pages.map(async (page: Page) => {
      const processed = await page.data.getText("processed");
      return `# ${page.data.title} (${origin}${page.url})\n\n${processed}`;
    }),
  );

  return sections.join("\n\n---\n\n");
}
