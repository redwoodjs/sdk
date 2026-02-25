"use client";

import { setTheme } from "@/app/actions/setTheme";
import { MoonIcon, SunIcon } from "@/app/components/ui/Icon";

function disableTransitions(): () => void {
  const css = document.createElement("style");
  css.appendChild(
    document.createTextNode(
      "*:not([data-theme-toggle]):not([data-theme-toggle] *),*:not([data-theme-toggle]):not([data-theme-toggle] *)::before,*:not([data-theme-toggle]):not([data-theme-toggle] *)::after{-webkit-transition:none!important;-moz-transition:none!important;-o-transition:none!important;-ms-transition:none!important;transition:none!important}",
    ),
  );
  document.head.appendChild(css);

  return () => {
    // Force restyle
    window.getComputedStyle(document.body);
    // Remove on next tick
    setTimeout(() => {
      document.head.removeChild(css);
    }, 1);
  };
}

export function ThemeToggle() {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={false}
      aria-label="Dark mode"
      data-theme-toggle=""
      onClick={(e) => {
        const root = document.documentElement;
        const isDark = root.classList.contains("dark");
        const newTheme = isDark ? "light" : "dark";

        const restore = disableTransitions();
        root.classList.toggle("dark");
        restore();

        e.currentTarget.setAttribute("aria-checked", String(!isDark));

        setTheme(newTheme).catch((error) => {
          console.error("Failed to set theme:", error);
        });
      }}
      ref={(el) => {
        if (el) {
          el.setAttribute(
            "aria-checked",
            String(document.documentElement.classList.contains("dark")),
          );
        }
      }}
      className="ms-auto relative flex h-8 w-16 cursor-pointer items-center rounded-full border border-fd-border bg-transparent p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring focus-visible:ring-offset-1"
    >
      {/* Sliding highlight — covers exactly half the pill */}
      <span className="pointer-events-none absolute left-0 top-0 h-full w-1/2 rounded-full bg-fd-accent transition-transform duration-200 ease-in-out dark:translate-x-full" />

      {/* Sun (light mode, left) */}
      <span className="relative z-10 flex h-full w-1/2 items-center justify-center">
        <SunIcon className="size-3.5 transition-colors duration-200 text-fd-accent-foreground dark:text-fd-muted-foreground" />
      </span>

      {/* Moon (dark mode, right) */}
      <span className="relative z-10 flex h-full w-1/2 items-center justify-center">
        <MoonIcon className="size-3.5 transition-colors duration-200 text-fd-muted-foreground dark:text-fd-accent-foreground" />
      </span>
    </button>
  );
}
