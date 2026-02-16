import { defineCollection, defineConfig } from "@content-collections/core";
import { compileMarkdown } from "@content-collections/markdown";
import { z } from "zod";

/**
 * Strip Astro-specific import lines from MDX content.
 * These imports reference packages that don't exist in our RedwoodSDK setup.
 * The JSX-like component tags (e.g. <Aside>) pass through the markdown
 * compiler as HTML elements, which we style with CSS.
 */
function stripAstroImports(content: string): string {
  return content
    .split("\n")
    .filter(
      (line) =>
        !line.match(
          /^\s*import\s+.*from\s+['"]@astrojs\/starlight\/components['"]/,
        ) &&
        !line.match(/^\s*import\s+.*from\s+['"]astro-embed['"]/),
    )
    .join("\n");
}

const docs = defineCollection({
  name: "docs",
  directory: "src/content/docs",
  include: "**/*.mdx",
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    slug: z.string().optional(),
  }),
  transform: async (document, context) => {
    const cleanedDoc = {
      ...document,
      content: stripAstroImports(document.content),
    };
    const body = await compileMarkdown(context, cleanedDoc, {
      remarkPlugins: [],
      rehypePlugins: [],
    });

    return {
      ...document,
      // Use frontmatter slug if provided, otherwise derive from file path
      slug: document.slug ?? document._meta.path,
      body,
    };
  },
});

export default defineConfig({
  collections: [docs],
});
