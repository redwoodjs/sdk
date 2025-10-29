// content-collections.ts
import { defineCollection, defineConfig } from "@content-collections/core";
import { compileMarkdown } from "@content-collections/markdown";
var posts = defineCollection({
  name: "posts",
  directory: "src/posts",
  include: "**/*.md",
  schema: (z) => ({
    title: z.string(),
    summary: z.string()
  }),
  transform: async (document, context) => {
    const body = await compileMarkdown(context, document, {
      remarkPlugins: [],
      rehypePlugins: []
    });
    return {
      ...document,
      body
    };
  }
});
var content_collections_default = defineConfig({
  collections: [posts]
});
export {
  content_collections_default as default
};
