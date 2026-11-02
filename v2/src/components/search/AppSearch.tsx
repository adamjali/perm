"use client";

/**
 * The app header's search: a box from `lg` up, an icon below it, and Cmd+K /
 * Ctrl+K anywhere in the signed-in app. The palette loads on the first open.
 */

import * as React from "react";
import dynamic from "next/dynamic";
import { CircleNotchIcon, MagnifyingGlassIcon } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";

const AppSearchPalette = dynamic(() => import("./AppSearchPalette"), { ssr: false });

export function AppSearch() {
  const [open, setOpen] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);
  // The first open loads the palette's code; the button spins until it's ready, as the public header's does.
  const [ready, setReady] = React.useState(false);
  const onReady = React.useCallback(() => setReady(true), []);
  const loadingPalette = loaded && !ready;
  const Icon = loadingPalette ? CircleNotchIcon : MagnifyingGlassIcon;
  const spin = loadingPalette ? "animate-spin motion-reduce:animate-none" : undefined;

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
        aria-label={loadingPalette ? "Opening search" : "Search your cases"}
        aria-busy={loadingPalette}
        className="flex size-11 items-center justify-center text-soft hover:bg-accent hover:text-foreground lg:hidden"
      >
        <Icon className={cn("size-5", spin)} aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={openPalette}
        aria-busy={loadingPalette}
        className="hidden h-10 w-56 items-center gap-2 border border-input bg-card px-3 text-left text-base text-muted-foreground hover:border-foreground lg:flex"
      >
        <Icon className={cn("size-4 shrink-0", spin)} aria-hidden="true" />
        <span className="flex-1">Search cases</span>{" "}
        <kbd className="font-mono text-sm">⌘K</kbd>
      </button>
      {loaded && <AppSearchPalette open={open} onOpenChange={setOpen} onReady={onReady} />}
    </>
  );
}
