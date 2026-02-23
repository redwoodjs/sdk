import { source } from "@/lib/source";
import { createFromSource } from "fumadocs-core/search/server";

export const searchAPI = createFromSource(source, {
  language: "english",
});
