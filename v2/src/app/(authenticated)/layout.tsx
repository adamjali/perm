/**
 * Authenticated Layout
 * Wraps all authenticated pages (Dashboard, Cases, Calendar, etc.)
 *
 * Features:
 * - Header with navigation
 * - Footer with links
 * - Dot pattern background (30% opacity)
 * - Min-height screen with flex layout
 * - Container padding
 * - Sign-out loading overlay
 * - Inactivity timeout with warning modal
 *
 * Phase: 20 (Dashboard + UI Polish)
 * Updated: 2025-12-24
 */

import Header from "@/components/layout/Header";
import DeletionBanner from "@/components/layout/DeletionBanner";
import Footer from "@/components/layout/Footer";
import SignOutOverlay from "@/components/layout/SignOutOverlay";
import InactivityTimeoutProvider from "@/components/layout/InactivityTimeoutProvider";
import { ChatWidgetConnected } from "@/components/chat/ChatWidgetConnected";
import { ServiceWorkerRegistration } from "@/components/pwa";
import { PendingTermsHandler } from "@/components/auth/PendingTermsHandler";
import { OnboardingProvider } from "@/components/onboarding/OnboardingProvider";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { OnboardingTourWrapper } from "@/components/onboarding/OnboardingTourWrapper";
import { PageTransition } from "@/components/ui/page-transition";

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <InactivityTimeoutProvider>
      {/* Register service worker for PWA functionality */}
      <ServiceWorkerRegistration />

      {/* Handle pending terms acceptance from Google OAuth redirect */}
      <PendingTermsHandler />

      {/* Onboarding: wizard + tour + checklist state management */}
      <OnboardingProvider>
        {/* Blocking onboarding wizard modal (shown for new users) */}
        <OnboardingWizard />

      <div className="relative flex min-h-screen flex-col bg-background">
        {/* Skip link for keyboard users */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:shadow-hard-sm focus:outline-none"
        >
          Skip to main content
        </a>

        {/* Fixed dot pattern background - matches other layouts */}
        <div
          className="bg-dots pointer-events-none fixed inset-0 opacity-30"
          aria-hidden="true"
        />

        {/* Header */}
        <Header />

        {/* Deletion warning banner (shown when account has scheduled deletion) */}
        <DeletionBanner />

        {/* Main content - grows to fill space */}
        <main
          id="main-content"
          className="relative mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-8"
          tabIndex={-1}
        >
          <PageTransition>{children}</PageTransition>
        </main>

        {/* Footer */}
        <Footer />

        {/* Sign-out loading overlay */}
        <SignOutOverlay />

        {/* Chat Widget */}
        <ChatWidgetConnected />
      </div>

        {/* Multi-page product tour (renders null, manages Driver.js) */}
        <OnboardingTourWrapper />
      </OnboardingProvider>
    </InactivityTimeoutProvider>
  );
}
