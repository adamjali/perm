"use client";

import { ReactNode } from "react";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { NavLinkProvider } from "@/components/ui/nav-link";

/**
 * Lightweight providers shared across ALL pages (public, auth, authenticated).
 * Does NOT include Convex, auth, or any heavy runtime.
 */
export function SharedProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <NavLinkProvider>
        {children}
      </NavLinkProvider>
      <Toaster />
    </ThemeProvider>
  );
}
