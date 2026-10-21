"use client";

/**
 * The header's search: a box that reads "Case number, employer or firm", and
 * the Cmd+K / Ctrl+K shortcut.
 *
 * A REAL FORM. Without scripts it submits to `/case-search?q=`, which answers a
 * case number by going to the case and a name with its results. With scripts,
 * focusing or typing in it opens the search palette with what's been typed, and
 * the palette takes it from there (suggestions, a case number straight to the
 * case, a month straight to the calculator).
 *
 * ONE COMPONENT, BOTH TRIGGERS: the box from `xl`, a search button below it.
 * Two components would mean two Cmd+K listeners and two palettes opening at
 * once. The palette is loaded on first open, so the public pages ship a box
 * and a key listener and nothing else.
 */

import * as React from "react";
import dynamic from "next/dynamic";
import { CircleNotchIcon, MagnifyingGlassIcon } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { trackPaletteOpened } from "@/lib/funnelEvents";

const SearchPalette = dynamic(() => import("./SearchPalette"), { ssr: false });

/** What the box asks for, everywhere it appears. */
export const SEARCH_PLACEHOLDER = "Case number, employer or firm";

export function SiteSearch({ className }: { className?: string }) {
  const [open, setOpen] = React.useState(false);
  const [initialQuery, setInitialQuery] = React.useState("");
  // The palette mounts after the first open and stays mounted after it.
  const [everOpened, setEverOpened] = React.useState(false);
  const [ready, setReady] = React.useState(false);
  const onReady = React.useCallback(() => setReady(true), []);
  const loadingPalette = everOpened && !ready;

  const openPalette = React.useCallback((how: "shortcut" | "button", typed = "") => {
    setInitialQuery(typed);
    setEverOpened(true);
    setOpen(true);
    trackPaletteOpened(how);
  }, []);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setEverOpened(true);
        setOpen((v) => {
          if (!v) trackPaletteOpened("shortcut");
          return !v;
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const Icon = loadingPalette ? CircleNotchIcon : MagnifyingGlassIcon;
  const icon = (
    <Icon
      aria-hidden="true"
      className={cn("size-5 shrink-0 text-muted-foreground", loadingPalette && "animate-spin motion-reduce:animate-none")}
    />
  );

  return (
    <>
      <button
        type="button"
        onClick={() => openPalette("button")}
        aria-label={loadingPalette ? "Opening search" : "Search"}
        aria-busy={loadingPalette}
        className="flex size-11 items-center justify-center text-foreground hover:bg-accent xl:hidden"
      >
        {icon}
      </button>{" "}
      <form
        action="/case-search"
        method="get"
        role="search"
        className={cn("relative hidden items-center xl:flex", className)}
        onSubmit={(e) => {
          // With scripts, the palette answers instead of a page load.
          e.preventDefault();
          const typed = new FormData(e.currentTarget).get("q");
          openPalette("button", typeof typed === "string" ? typed : "");
        }}
      >
        <label htmlFor="site-search" className="sr-only">
          Search
        </label>
        <span className="pointer-events-none absolute left-3">{icon}</span>
        <input
          id="site-search"
          name="q"
          type="search"
          autoComplete="off"
          enterKeyHint="search"
          placeholder={SEARCH_PLACEHOLDER}
          onFocus={(e) => openPalette("button", e.currentTarget.value)}
          className="h-10 w-full min-w-0 text-ellipsis border border-input bg-card pl-10 pr-12 text-base placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <kbd className="pointer-events-none absolute right-3 hidden font-mono text-sm text-muted-foreground xl:inline">
          ⌘K
        </kbd>
      </form>
      {everOpened ? (
        <SearchPalette
          open={open}
          onOpenChange={setOpen}
          onReady={onReady}
          initialQuery={initialQuery}
        />
      ) : null}
    </>
  );
}
