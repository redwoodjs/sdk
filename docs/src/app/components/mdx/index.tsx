/**
 * Barrel re-export for all MDX components.
 * Vite aliases resolve Astro package imports to this file.
 */
export { Aside } from "./Aside";
export { Badge } from "./Badge";
export { Card, CardGrid } from "./Card";
export { FileTree, File, Folder } from "./FileTree";
export { LinkCard } from "./LinkCard";
export { PackageManagers } from "./package-managers";
export { Steps, Step } from "./Steps";
export { Tabs, TabItem } from "./Tabs";
export { YouTube } from "./YouTube";

// Compatibility: some MDX files still import Code from Starlight
export function Code({ code, lang }: { code: string; lang?: string; title?: string }) {
  return (
    <pre><code className={lang ? `language-${lang}` : ""}>{code}</code></pre>
  );
}
