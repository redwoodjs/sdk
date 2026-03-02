import { defineDocs, defineConfig, frontmatterSchema } from "fumadocs-mdx/config";
import lastModified from "fumadocs-mdx/plugins/last-modified";
import { z } from "zod";

export const docs = defineDocs({
  dir: "src/content/docs",
  docs: {
    schema: frontmatterSchema.extend({
      tableOfContents: z.boolean().default(true),
    }),
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
});

export default defineConfig({
  plugins: [lastModified()],
});
