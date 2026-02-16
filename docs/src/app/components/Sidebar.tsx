import { sidebar, isGroup, type SidebarItem } from "@/app/sidebar";
import { link } from "@/app/shared/links";
import darkLogoUrl from "@/assets/dark-logo.svg?url";

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className="size-4 text-zinc-500"
    >
      <path
        fillRule="evenodd"
        d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className="size-5">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

function DiscordIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className="size-5">
      <path d="M13.545 2.907a13.227 13.227 0 00-3.257-1.011.05.05 0 00-.052.025c-.141.25-.297.577-.406.833a12.19 12.19 0 00-3.658 0 8.258 8.258 0 00-.412-.833.051.051 0 00-.052-.025c-1.125.194-2.22.534-3.257 1.011a.041.041 0 00-.021.018C.356 6.024-.213 9.047.066 12.032c.001.014.01.028.021.037a13.276 13.276 0 003.995 2.02.05.05 0 00.056-.019c.308-.42.582-.863.818-1.329a.05.05 0 00-.027-.07 8.735 8.735 0 01-1.248-.595.05.05 0 01-.005-.083c.084-.063.168-.129.248-.195a.05.05 0 01.051-.007c2.619 1.196 5.454 1.196 8.041 0a.052.052 0 01.053.007c.08.066.164.132.248.195a.051.051 0 01-.004.085c-.399.232-.813.44-1.249.594a.05.05 0 00-.03.07c.24.465.515.909.817 1.329a.05.05 0 00.056.019 13.235 13.235 0 004.001-2.02.049.049 0 00.021-.037c.334-3.451-.559-6.449-2.366-9.106a.034.034 0 00-.02-.019zm-8.198 7.307c-.789 0-1.438-.724-1.438-1.612 0-.889.637-1.613 1.438-1.613.807 0 1.45.73 1.438 1.613 0 .888-.637 1.612-1.438 1.612zm5.316 0c-.788 0-1.438-.724-1.438-1.612 0-.889.637-1.613 1.438-1.613.807 0 1.451.73 1.438 1.613 0 .888-.631 1.612-1.438 1.612z" />
    </svg>
  );
}

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
    <aside className="sticky top-0 flex h-screen flex-col border-r border-zinc-800 bg-zinc-900">
      {/* Header: Logo + Search — sticky top */}
      <div className="flex-shrink-0 px-4 pt-4 pb-3">
        <a href={link("/")} className="mb-4 flex items-center no-underline">
          <img src={darkLogoUrl} alt="RedwoodSDK" className="h-6" />
        </a>
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5">
            <SearchIcon />
          </div>
          <input
            type="text"
            placeholder="Search docs..."
            className="w-full rounded-md border border-zinc-700 bg-zinc-800 py-1.5 pl-8 pr-3 text-sm text-zinc-200 placeholder-zinc-500 outline-none transition-colors focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
          />
        </div>
      </div>

      {/* Navigation — scrollable */}
      <nav className="flex-1 overflow-y-auto px-4 py-4">
        <SidebarItems items={sidebar} currentSlug={currentSlug} />
      </nav>

      {/* Footer: Social icons — sticky bottom */}
      <div className="flex flex-shrink-0 items-center gap-3 border-t border-zinc-800 px-4 py-3">
        <a
          href="https://community.redwoodjs.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-zinc-400 transition-colors hover:text-zinc-100"
          aria-label="Discord"
        >
          <DiscordIcon />
        </a>
        <a
          href="https://github.com/redwoodjs/sdk"
          target="_blank"
          rel="noopener noreferrer"
          className="text-zinc-400 transition-colors hover:text-zinc-100"
          aria-label="GitHub"
        >
          <GitHubIcon />
        </a>
      </div>
    </aside>
  );
}
