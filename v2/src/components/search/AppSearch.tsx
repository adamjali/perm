"use client";

/**
 * The app header's search: a box from `lg` up, an icon below it, and Cmd+K /
 * Ctrl+K anywhere in the signed-in app. The palette loads on the first open.
 */

import * as React from "react";
import dynamic from "next/dynamic";
import { MagnifyingGlassIcon } from "@phosphor-icons/react";

const AppSearchPalette = dynamic(() => import("./AppSearchPalette"), { ssr: false });

export function AppSearch() {
  const [open, setOpen] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);

  const openPalette = React.useCallback(() => {
    setLoaded(true);
    setOpen(true);
  }, []);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openPalette();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openPalette]);

  return (
    <>
      <button
        type="button"
        onClick={openPalette}
        aria-label="Search your cases"
        className="flex size-11 items-center justify-center text-soft hover:bg-accent hover:text-foreground lg:hidden"
      >
        <MagnifyingGlassIcon className="size-5" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={openPalette}
        className="hidden h-10 w-56 items-center gap-2 border border-input bg-card px-3 text-left text-base text-muted-foreground hover:border-foreground lg:flex"
      >
        <MagnifyingGlassIcon className="size-4 shrink-0" aria-hidden="true" />
        <span className="flex-1">Search cases</span>{" "}
        <kbd className="font-mono text-sm">⌘K</kbd>
      </button>
      {loaded && <AppSearchPalette open={open} onOpenChange={setOpen} />}
    </>
  );
}
