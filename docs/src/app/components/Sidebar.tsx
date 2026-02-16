import { sidebar, isGroup, type SidebarItem } from "@/app/sidebar";
import { link } from "@/app/shared/links";

function SidebarItems({
  items,
  currentSlug,
  depth = 0,
}: {
  items: SidebarItem[];
  currentSlug: string;
  depth?: number;
}) {
  return (
    <ul className={depth === 0 ? "space-y-4" : "ml-2 space-y-0.5"}>
      {items.map((item) => {
        if (isGroup(item)) {
          return (
            <li key={item.label}>
              <span className="block px-2 py-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                {item.label}
              </span>
              <SidebarItems
                items={item.items}
                currentSlug={currentSlug}
                depth={depth + 1}
              />
            </li>
          );
        }

        const isActive = currentSlug === item.slug;
        return (
          <li key={item.slug}>
            <a
              href={link("/*", { $0: item.slug })}
              className={`block rounded px-2 py-1 text-sm transition-colors ${
                isActive
                  ? "font-medium text-blue-400"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {item.label}
            </a>
          </li>
        );
      })}
    </ul>
  );
}

export function Sidebar({ currentSlug }: { currentSlug: string }) {
  return (
    <nav className="sticky top-0 h-screen w-70 shrink-0 overflow-y-auto border-r border-zinc-800 bg-zinc-900 px-4 py-6">
      <a
        href={link("/")}
        className="mb-4 block border-b border-zinc-800 pb-4 text-xl font-bold text-zinc-100 no-underline"
      >
        RedwoodSDK
      </a>
      <SidebarItems items={sidebar} currentSlug={currentSlug} />
    </nav>
  );
}
