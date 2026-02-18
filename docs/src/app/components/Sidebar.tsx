"use client";

import type * as PageTree from "fumadocs-core/page-tree";
import { Collapsible } from "@base-ui/react/collapsible";
import clsx from "clsx";
import { pageTree } from "@/app/sidebar";
import { ScrollArea, ScrollViewport } from "fumadocs-ui/components/ui/scroll-area";
import { MessageCircle } from "lucide-react";
import { Github } from "lucide-react";
import darkLogoUrl from "@/assets/dark-logo.svg?url";
import { ThemeToggle } from "@/app/components/ThemeToggle";

function ChevronDown({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function getItemOffset(depth: number) {
  return `calc(${2 + 3 * depth} * var(--spacing))`;
}

function hasActiveDescendant(
  nodes: PageTree.Node[],
  pathname: string,
): boolean {
  return nodes.some((node) => {
    if (node.type === "page") return pathname === node.url;
    if (node.type === "folder") return hasActiveDescendant(node.children, pathname);
    return false;
  });
}

function SidebarSeparator({
  name,
  depth,
  isFirst,
}: {
  name: string;
  depth: number;
  isFirst: boolean;
}) {
  return (
    <li
      className={clsx(
        "inline-flex items-center gap-2 mb-1.5 px-2 text-base font-bold text-fd-foreground",
        !(depth === 0 && isFirst) && "mt-4",
      )}
      style={{ paddingInlineStart: getItemOffset(depth) }}
    >
      {name}
    </li>
  );
}

function SidebarLink({
  name,
  url,
  isActive,
  depth,
}: {
  name: string;
  url: string;
  isActive: boolean;
  depth: number;
}) {
  const highlight = depth >= 1;
  return (
    <li>
      <a
        href={url}
        data-active={isActive}
        className={clsx(
          "relative flex flex-row items-center gap-2 rounded-lg p-2 text-start text-sm text-fd-muted-foreground transition-colors hover:bg-fd-accent/50 hover:text-fd-accent-foreground/80 hover:transition-none data-[active=true]:bg-fd-primary/10 data-[active=true]:text-fd-primary",
          highlight && "data-[active=true]:before:content-[''] data-[active=true]:before:bg-fd-primary data-[active=true]:before:absolute data-[active=true]:before:w-px data-[active=true]:before:inset-y-2.5 data-[active=true]:before:start-2.5",
        )}
        style={{ paddingInlineStart: getItemOffset(depth) }}
      >
        {name}
      </a>
    </li>
  );
}

function SidebarFolder({
  node,
  pathname,
  depth,
}: {
  node: PageTree.Folder;
  pathname: string;
  depth: number;
}) {
  const defaultOpen = hasActiveDescendant(node.children, pathname);

  return (
    <li>
      <Collapsible.Root defaultOpen={defaultOpen}>
        <Collapsible.Trigger
          className="group relative flex w-full flex-row items-center gap-2 rounded-lg p-2 text-start text-sm text-fd-muted-foreground transition-colors hover:bg-fd-accent/50 hover:text-fd-accent-foreground/80 hover:transition-none"
          style={{ paddingInlineStart: getItemOffset(depth) }}
        >
          {node.name}
          <ChevronDown className="ms-auto size-4 shrink-0 transition-transform -rotate-90 group-data-[panel-open]:rotate-0" />
        </Collapsible.Trigger>
        <Collapsible.Panel
          className={clsx(
            "relative overflow-hidden [transition:height_200ms,opacity_300ms] h-(--collapsible-panel-height) opacity-100 data-ending-style:h-0 data-starting-style:h-0 data-ending-style:opacity-0 data-starting-style:opacity-0",
            depth === 0 && "before:content-[''] before:absolute before:w-px before:inset-y-1 before:bg-fd-border before:start-2.5",
          )}
        >
          <SidebarNodes
            nodes={node.children}
            pathname={pathname}
            depth={depth + 1}
          />
        </Collapsible.Panel>
      </Collapsible.Root>
    </li>
  );
}

function SidebarNodes({
  nodes,
  pathname,
  depth,
}: {
  nodes: PageTree.Node[];
  pathname: string;
  depth: number;
}) {
  return (
    <ul className="flex flex-col">
      {nodes.map((node, i) => {
        if (node.type === "separator") {
          return (
            <SidebarSeparator
              key={`sep-${node.name}`}
              name={node.name}
              depth={depth}
              isFirst={i === 0}
            />
          );
        }

        if (node.type === "folder") {
          return (
            <SidebarFolder
              key={`folder-${node.name}`}
              node={node}
              pathname={pathname}
              depth={depth}
            />
          );
        }

        return (
          <SidebarLink
            key={node.url}
            name={node.name}
            url={node.url}
            isActive={pathname === node.url}
            depth={depth}
          />
        );
      })}
    </ul>
  );
}

export function Sidebar({ pathname, initialTheme }: { pathname: string; initialTheme?: "dark" | "light" | "system" }) {
  return (
    <div className="sticky top-(--fd-docs-row-1) [grid-area:sidebar] h-[calc(var(--fd-docs-height)-var(--fd-docs-row-1))] max-md:hidden md:layout:[--fd-sidebar-width:268px]">
      <aside className="flex h-full flex-col border-e border-fd-border">
        <div className="flex shrink-0 items-center gap-2 px-4 pt-4 pb-2">
          <a href="/">
            <img src={darkLogoUrl} alt="RedwoodSDK" className="h-8" />
          </a>
        </div>
        <ScrollArea className="flex-1">
          <ScrollViewport className="px-2 py-4">
            <SidebarNodes
              nodes={pageTree.children}
              pathname={pathname}
              depth={0}
            />
          </ScrollViewport>
        </ScrollArea>
        <div className="flex shrink-0 items-center gap-1.5 border-t border-fd-border px-4 py-3">
          <a
            href="https://discord.gg/redwoodjs"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-md p-1.5 text-fd-muted-foreground transition-colors hover:bg-fd-accent/50 hover:text-fd-accent-foreground"
            aria-label="Discord"
          >
            <MessageCircle className="size-4.5" />
          </a>
          <a
            href="https://github.com/redwoodjs/sdk"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-md p-1.5 text-fd-muted-foreground transition-colors hover:bg-fd-accent/50 hover:text-fd-accent-foreground"
            aria-label="GitHub"
          >
            <Github className="size-4.5" />
          </a>
          <ThemeToggle initialTheme={initialTheme} />
        </div>
      </aside>
    </div>
  );
}
