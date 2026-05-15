import { defineDocs, defineConfig, frontmatterSchema } from "fumadocs-mdx/config";
import { rehypeCodeDefaultOptions } from "fumadocs-core/mdx-plugins";
import lastModified from "fumadocs-mdx/plugins/last-modified";
import { z } from "zod";
import { transformerExpressiveCode } from "./src/lib/transformers/expressive-code";

export const docs = defineDocs({
  dir: "src/content/docs",
  docs: {
    schema: frontmatterSchema.extend({
      tableOfContents: z.boolean().default(true),
      experimental: z.boolean().default(false),
    }),
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
});

export default defineConfig({
  mdxOptions: {
    rehypeCodeOptions: {
      ...rehypeCodeDefaultOptions,
      transformers: [
        ...(rehypeCodeDefaultOptions.transformers ?? []),
        transformerExpressiveCode(),
      ],
    },
  },
  plugins: [lastModified()],
});
