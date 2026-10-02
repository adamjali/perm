"use client";

import { useEffect } from "react";

/**
 * Opens the folded section a link points at.
 *
 * The legal pages fold each section under its heading. A jump
 * from the section index lands on the heading either way, since the summary is
 * always shown; this opens the section too, on load and on every hash change,
 * so following "#user-accounts" shows the clause and not just its title.
 * Find-in-page already opens a closed `<details>` in current browsers.
 */
export function OpenOnHash() {
  useEffect(() => {
    const open = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!id) return;
      document.getElementById(id)?.closest("details")?.setAttribute("open", "");
    };
    open();
    window.addEventListener("hashchange", open);
    return () => window.removeEventListener("hashchange", open);
  }, []);
  return null;
}
