"use client";

/**
 * The search trigger: a header button plus the Cmd+K / Ctrl+K shortcut.
 *
 * The palette itself is dynamically imported ON FIRST OPEN, so the public
 * pages ship a button and a key listener and nothing else - cmdk and the
 * whole index stay out of the marketing bundles until someone reaches for
 * them.
 */

import * as React from "react";
import dynamic from "next/dynamic";
import { CircleNotchIcon, MagnifyingGlassIcon } from "@phosphor-icons/react";

import type { SearchArticle } from "./SearchPalette";
import { cn } from "@/lib/utils";

const SearchPalette = dynamic(() => import("./SearchPalette"), { ssr: false });

export function SiteSearch({
  articles,
  className,
}: {
  articles: SearchArticle[];
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  // The palette mounts only after the first open and stays mounted after,
  // so reopening is instant.
  const [everOpened, setEverOpened] = React.useState(false);
  // THE FIRST PRESS DOWNLOADS A CHUNK, AND IT USED TO SAY NOTHING WHILE IT DID.
  // cmdk plus the whole static index is deliberately kept out of the marketing
  // bundles, which is right - but it means the first click on this button is a
  // network fetch, and on a slow connection the button just sat there. "I click
  // and nothing happens" is the literal description of that. The palette calls
  // `onReady` on mount, which is the only honest end to the wait.
  const [ready, setReady] = React.useState(false);
  const onReady = React.useCallback(() => setReady(true), []);
  const loadingPalette = everOpened && !ready;

  const openPalette = React.useCallback(() => {
    setEverOpened(true);
    setOpen(true);
  }, []);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setEverOpened(true);
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={openPalette}
        aria-label={loadingPalette ? "Opening search" : "Search the site"}
        aria-busy={loadingPalette}
        className={cn(
          // `h-11`, not `min-h-11`: this is the search affordance on every
          // public page and 44px is the tap-target floor.
          "flex h-11 items-center gap-2 border-2 border-white/20 px-3 text-white transition-colors hover:bg-white/10",
          className,
        )}
      >
        {loadingPalette ? (
          <CircleNotchIcon
            className="h-4 w-4 animate-spin motion-reduce:animate-none"
            weight="bold"
            aria-hidden="true"
          />
        ) : (
          <MagnifyingGlassIcon className="h-4 w-4" aria-hidden="true" />
        )}
        <span className="hidden font-mono text-xs font-bold text-white/60 xl:inline">
          ⌘K
        </span>
      </button>
      {everOpened ? (
        <SearchPalette
          open={open}
          onOpenChange={setOpen}
          articles={articles}
          onReady={onReady}
        />
      ) : null}
    </>
  );
}
