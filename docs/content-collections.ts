import { defineCollection, defineConfig } from "@content-collections/core";
import { z } from "zod";

const docs = defineCollection({
  name: "docs",
  directory: "src/content/docs",
  include: "**/*.mdx",
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    slug: z.string().optional(),
  }),
  transform: (document) => ({
    ...document,
    slug: document.slug ?? document._meta.path,
  }),
});

export default defineConfig({
  collections: [docs],
});
