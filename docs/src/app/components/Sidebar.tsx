"use client";

import { useEffect, useState } from "react";
import type * as PageTree from "fumadocs-core/page-tree";
import { Collapsible } from "@base-ui/react/collapsible";
import { Dialog } from "@base-ui/react/dialog";
import clsx from "clsx";
import { pageTree } from "@/app/sidebar";
import { ScrollArea, ScrollViewport } from "fumadocs-ui/components/ui/scroll-area";
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

function SidebarFooter({ initialTheme }: { initialTheme?: "dark" | "light" | "system" }) {
  return (
    <div className="flex shrink-0 items-center gap-1.5 border-t border-fd-border px-4 py-3">
      <a
        href="https://discord.gg/redwoodjs"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center rounded-md p-1.5 text-fd-muted-foreground transition-colors hover:bg-fd-accent/50 hover:text-fd-accent-foreground"
        aria-label="Discord"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="size-4.5">
          <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
        </svg>
      </a>
      <a
        href="https://github.com/redwoodjs/sdk"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center rounded-md p-1.5 text-fd-muted-foreground transition-colors hover:bg-fd-accent/50 hover:text-fd-accent-foreground"
        aria-label="GitHub"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="size-4.5">
          <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
        </svg>
      </a>
      <ThemeToggle initialTheme={initialTheme} />
    </div>
  );
}

function Logo() {
  return (
    <a href="/">
      <img src="/logo--dark.svg" alt="RedwoodSDK" className="h-8 hidden dark:block" />
      <img src="/logo--light.svg" alt="RedwoodSDK" className="h-8 block dark:hidden" />
    </a>
  );
}

export function MobileNav({ pathname, initialTheme }: { pathname: string; initialTheme?: "dark" | "light" | "system" }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-fd-border bg-fd-background px-4 h-14 md:hidden">
        <Logo />
        <Dialog.Trigger
          className="inline-flex items-center justify-center rounded-md p-2 text-fd-muted-foreground hover:bg-fd-accent/50 hover:text-fd-accent-foreground"
          aria-label="Open navigation"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="size-5">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </Dialog.Trigger>
      </header>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/50 [transition:opacity_200ms] opacity-100 data-starting-style:opacity-0 data-ending-style:opacity-0" />
        <Dialog.Popup className="fixed inset-y-0 left-0 z-50 w-72 bg-fd-background border-e border-fd-border [transition:transform_200ms] translate-x-0 data-starting-style:-translate-x-full data-ending-style:-translate-x-full">
          <div className="flex h-full flex-col">
            <div className="flex shrink-0 items-center justify-between px-4 pt-4 pb-2">
              <Logo />
              <Dialog.Close
                className="inline-flex items-center justify-center rounded-md p-1.5 text-fd-muted-foreground hover:bg-fd-accent/50 hover:text-fd-accent-foreground"
                aria-label="Close navigation"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="size-4">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </Dialog.Close>
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
            <SidebarFooter initialTheme={initialTheme} />
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function Sidebar({ pathname, initialTheme }: { pathname: string; initialTheme?: "dark" | "light" | "system" }) {
  return (
    <div className="sticky top-0 [grid-area:sidebar] w-[16rem] h-dvh max-md:hidden">
      <aside className="flex h-full flex-col border-e border-fd-border">
        <div className="flex shrink-0 items-center gap-2 px-4 pt-4 pb-2">
          <Logo />
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
        <SidebarFooter initialTheme={initialTheme} />
      </aside>
    </div>
  );
}
