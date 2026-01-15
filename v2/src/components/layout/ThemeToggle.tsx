"use client";

/**
 * ThemeToggle Component
 * Button to toggle between light and dark themes using next-themes.
 *
 * Features:
 * - Shows Sun icon in dark mode (to switch to light)
 * - Shows Moon icon in light mode (to switch to dark)
 * - Ghost variant styling for black header backgrounds
 * - Accessible with aria-label
 * - Cursor pointer on hover
 *
 * Phase: 20-02 (Dashboard Data Layer)
 * Updated: 2025-12-24
 */

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  // Show placeholder during SSR to avoid hydration mismatch
  if (!mounted) {
    return (
      <button
        type="button"
        aria-label="Toggle theme"
        className="relative flex h-10 w-10 cursor-pointer items-center justify-center rounded-none border-2 border-transparent bg-transparent transition-all duration-150"
      >
        <div className="size-5" />
      </button>
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      className="group relative flex h-11 w-11 cursor-pointer items-center justify-center rounded-none border-2 border-white/30 bg-transparent text-white transition-all duration-150 hover:bg-primary hover:border-primary hover:text-black hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard-sm active:translate-x-0 active:translate-y-0 active:shadow-none"
    >
      {isDark ? (
        <Sun className="size-5 transition-transform duration-300 ease-out group-hover:rotate-[20deg] group-hover:scale-110 group-active:rotate-0 group-active:scale-95" />
      ) : (
        <Moon className="size-5 transition-transform duration-300 ease-out group-hover:rotate-[20deg] group-hover:scale-110 group-active:rotate-0 group-active:scale-95" />
      )}
    </button>
  );
}
