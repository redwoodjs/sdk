import { defineCollection, z } from "astro:content";
import { docsLoader } from "@astrojs/starlight/loaders";
import { docsSchema } from "@astrojs/starlight/schema";

export const collections = {
  docs: defineCollection({
    loader: docsLoader(),
    schema: docsSchema({
      extend: z.object({
        banner: z
          .object({
            content: z.string(),
          })
          .default({
            content:
              "4th April 2025: This is a preview, whilst production-ready, it means some <a href='https://github.com/redwoodjs/sdk/issues/244' target='_blank'>APIs might change</a>",
          }),
      }),
    }),
  }),
};
