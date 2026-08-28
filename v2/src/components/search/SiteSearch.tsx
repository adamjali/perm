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
import { MagnifyingGlass } from "@phosphor-icons/react";

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
        aria-label="Search the site"
        className={cn(
          "flex h-11 items-center gap-2 border-2 border-white/20 px-3 text-white transition-colors hover:bg-white/10",
          className,
        )}
      >
        <MagnifyingGlass className="h-4 w-4" />
        <span className="hidden font-mono text-xs font-bold text-white/60 xl:inline">
          ⌘K
        </span>
      </button>
      {everOpened ? (
        <SearchPalette open={open} onOpenChange={setOpen} articles={articles} />
      ) : null}
    </>
  );
}
