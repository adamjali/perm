"use client";

import { useSyncExternalStore } from "react";

import { authPageHref } from "@/lib/auth/returnTo";

function subscribe(onChange: () => void): () => void {
  window.addEventListener("hashchange", onChange);
  window.addEventListener("popstate", onChange);
  return () => {
    window.removeEventListener("hashchange", onChange);
    window.removeEventListener("popstate", onChange);
  };
}

const address = () => `${window.location.search}\u0000${window.location.hash}`;

/**
 * A link to another sign-in page (sign-up, reset, back to sign-in) that keeps the page to come back to and
 * the calculator's dates. The sign-in pages are prerendered, and a #section exists only in the browser, so
 * the server render links the bare page and the browser fills the rest in.
 */
export function useAuthPageHref(path: "/login" | "/signup" | "/reset-password"): string {
  const current = useSyncExternalStore(subscribe, address, () => "\u0000");
  const [search, hash] = current.split("\u0000");
  return authPageHref(path, search ?? "", hash ?? "");
}
