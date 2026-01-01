"use client";

import { useEffect, useRef, useState } from "react";
import { setTheme } from "../actions/setTheme";

type Theme = "dark" | "light" | "system";

export function ThemeToggle({ initialTheme }: { initialTheme: Theme }) {
  const [theme, setThemeState] = useState<Theme>(initialTheme);
  const isInitialMount = useRef(true);

  // Update DOM when theme changes
  useEffect(() => {
    const root = document.documentElement;
    const shouldBeDark =
      theme === "dark" ||
      (theme === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);

    if (shouldBeDark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    // Set data attribute for consistency
    root.setAttribute("data-theme", theme);

    // Persist to cookie via server action (only when theme actually changes, not on initial mount)
    if (!isInitialMount.current) {
      setTheme(theme).catch((error) => {
        console.error("Failed to set theme:", error);
      });
    } else {
      isInitialMount.current = false;
    }
  }, [theme]);

  // Listen for system theme changes when theme is "system"
  useEffect(() => {
    if (theme !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      const root = document.documentElement;
      if (mediaQuery.matches) {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  const toggleTheme = () => {
    // Cycle through: system -> light -> dark -> system
    if (theme === "system") {
      setThemeState("light");
    } else if (theme === "light") {
      setThemeState("dark");
    } else {
      setThemeState("system");
    }
  };

  return (
    <div className="flex items-center gap-4">
      <span>Current theme: {theme}</span>
      <button
        onClick={toggleTheme}
        className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-gray-200 transition-colors"
        aria-label="Toggle theme"
      >
        {theme === "dark" ? "☀️" : theme === "light" ? "🌙" : "💻"}
      </button>
    </div>
  );
}
