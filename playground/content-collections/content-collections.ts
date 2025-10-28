import { defineCollection, defineConfig } from "@content-collections/core";
import { compileMarkdown } from "@content-collections/markdown";

const posts = defineCollection({
  name: "posts",
  directory: "src/posts",
  include: "**/*.md",
  schema: (z) => ({
    title: z.string(),
    summary: z.string(),
  }),
  transform: async (document, context) => {
    const body = await compileMarkdown(context, document, {
      remarkPlugins: [],
      rehypePlugins: [],
    });
    return {
      ...document,
      body,
    };
  },
});

export default defineConfig({
  collections: [posts],
});
