"use client";

import { ReactNode } from "react";
import { MotionConfig } from "motion/react";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { NavLinkProvider } from "@/components/ui/nav-link";
import { SpotMotion } from "@/components/ui/spot-motion";

/**
 * Lightweight providers for ALL pages (public + authenticated).
 * Does NOT include Convex, auth, or AI context, those are in ConvexProviders.
 *
 * `reducedMotion="user"`: every Motion animation on the site follows the
 * visitor's reduced-motion setting, so no component has to remember to.
 */
export function SharedProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <MotionConfig reducedMotion="user">
        <NavLinkProvider>
          {children}
        </NavLinkProvider>
      </MotionConfig>
      <Toaster />
      <SpotMotion />
    </ThemeProvider>
  );
}
