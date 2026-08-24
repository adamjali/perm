/**
 * Public Layout
 * Wraps all public pages (Home, Demo, Pricing, etc.)
 *
 * Features:
 * - ScrollProgress bar at top
 * - AuthHeader with navigation
 * - Extended Footer with logo and nav links
 * - Dot pattern background (30% opacity) - consistent with auth/authenticated layouts
 * - Grain overlay (from root layout)
 * - Min-height screen with flex layout
 *
 */

import AuthHeader from "@/components/layout/AuthHeader";
import Footer from "@/components/layout/Footer";
import { SecurityIncidentBanner } from "@/components/layout/SecurityIncidentBanner";
import { ScrollProgress } from "@/components/home";
import { PageTransition } from "@/components/ui/page-transition";
import { ScrollToTop } from "@/components/ui/scroll-to-top";
import { HashScrollHandler } from "@/components/ui/hash-scroll-handler";
import { ViewportDiag } from "@/components/diag/ViewportDiag";
import { AmbientMurmuration } from "@/components/home/AmbientMurmuration";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      {/* One ambient system for the whole public surface: a small murmuration
          at field opacity, steered by scroll along an invisible path. Opaque
          bands cover it; it lives on the dotted ground between them. */}
      <AmbientMurmuration />
      {/* Scroll progress indicator */}
      <ScrollProgress />

      {/* Skip link for keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:shadow-hard-sm focus:outline-none"
      >
        Skip to main content
      </a>

      {/* Fixed dot pattern background - matches other layouts */}
      <div
        className="bg-dots pointer-events-none fixed inset-0 opacity-30"
        aria-hidden="true"
      />

      {/* Security incident banner — dismissible, auto-hides after 2026-04-27 */}
      <SecurityIncidentBanner />

      {/* Header */}
      <AuthHeader />
      <HashScrollHandler />

      {/* Main content - grows to fill space, pt accounts for fixed header (~64px)
          plus security banner if visible (--security-banner-h published by
          SecurityIncidentBanner when mounted, cleared to 0 when dismissed). */}
      <main
        id="main-content"
        style={{ paddingTop: "calc(4rem + var(--security-banner-h, 0px))" }}
        className="relative flex-1 transition-[padding] duration-200"
        tabIndex={-1}
      >
        <PageTransition>{children}</PageTransition>
      </main>

      {/* Extended Footer for public pages */}
      <Footer variant="extended" />

      {/* Back-to-top button */}
      <ScrollToTop />

      {/* On-device layout diagnostic. Inert without ?diag=1 in the URL. */}
      <ViewportDiag />
    </div>
  );
}
