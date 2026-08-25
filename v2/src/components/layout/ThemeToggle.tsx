"use client";

/**
 * Light/dark toggle for the black header.
 *
 * NO HYDRATION PLACEHOLDER, deliberately. The previous version rendered a
 * borderless `rounded-full` button holding an empty box until `mounted`
 * flipped, then swapped to a `rounded-none border-2` button holding an icon.
 * That is a circle becoming a square and an empty slot growing a glyph, in
 * the rightmost position of the header, on every page, every first load. It
 * was one of the causes of the reported "header flashes a different one
 * before the correct one".
 *
 * The markup is now identical before and after hydration, and which icon
 * shows is decided by CSS from the `.dark` class that next-themes puts on
 * <html> in its own pre-paint script. So the server can render both icons
 * without knowing the theme and exactly one is ever visible, with no swap.
 *
 * `mounted` still gates the CLICK, because `resolvedTheme` is genuinely
 * unknown until the effect runs and toggling from a guess would flip the
 * wrong way.
 */

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

const ICON =
  "size-5 transition-transform duration-300 ease-out group-hover:rotate-[20deg] group-hover:scale-110 group-active:rotate-0 group-active:scale-95";

export default function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <button
      type="button"
      onClick={() => {
        if (!mounted) return;
        setTheme(resolvedTheme === "dark" ? "light" : "dark");
      }}
      // Generic until the theme is known, so the label does not change shape
      // either. 44px because a standalone control clears the tap-target floor.
      aria-label={
        mounted
          ? `Switch to ${resolvedTheme === "dark" ? "light" : "dark"} mode`
          : "Toggle theme"
      }
      className="group relative flex h-11 w-11 cursor-pointer items-center justify-center rounded-none border-2 border-transparent bg-transparent text-white transition-all duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:border-primary hover:bg-primary hover:text-black hover:shadow-hard-sm active:translate-x-0 active:translate-y-0 active:shadow-none"
    >
      {/* Both render; CSS picks one from the .dark class next-themes sets
          before first paint. Never both, never neither, never a swap. */}
      <Sun className={`${ICON} hidden dark:block`} aria-hidden="true" />
      <Moon className={`${ICON} block dark:hidden`} aria-hidden="true" />
    </button>
  );
}
