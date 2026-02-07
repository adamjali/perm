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
import { ScrollProgress } from "@/components/home";
import { PageTransition } from "@/components/ui/page-transition";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col bg-background">
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

      {/* Header */}
      <AuthHeader />

      {/* Main content - grows to fill space, pt-20 for fixed header (~80px) */}
      <main
        id="main-content"
        className="relative flex-1 pt-20"
        tabIndex={-1}
      >
        <PageTransition>{children}</PageTransition>
      </main>

      {/* Extended Footer for public pages */}
      <Footer variant="extended" />
    </div>
  );
}
