"use client";

import { useEffect, useRef } from "react";
import { captureError } from "@/lib/sentry";
import { useQuery, useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "../../../../convex/_generated/api";
import { Skeleton } from "@/components/ui/skeleton";
import SummaryTilesGrid from "@/components/dashboard/SummaryTilesGrid";
import DeadlineHeroWidget from "@/components/dashboard/DeadlineHeroWidget";
import RecentActivityWidget from "@/components/dashboard/RecentActivityWidget";
import UpcomingDeadlinesWidget from "@/components/dashboard/UpcomingDeadlinesWidget";
import AddCaseButton from "@/components/dashboard/AddCaseButton";
import AutoClosureAlertBanner from "@/components/dashboard/AutoClosureAlertBanner";
import { OnboardingChecklist } from "@/components/onboarding/OnboardingChecklist";
import { QueuePulseWidget } from "@/components/dashboard/QueuePulseWidget";

export function DashboardPageClient() {
  const router = useRouter();
  const currentUser = useQuery(api.users.currentUser);
  const hasRunEnforcement = useRef(false);

  // Check if enforcement is enabled
  const isEnforcementEnabled = useQuery(api.deadlineEnforcement.isEnforcementEnabled);

  // Mutation to check and enforce deadlines
  const checkDeadlines = useMutation(api.deadlineEnforcement.checkAndEnforceDeadlines);

  // Run deadline enforcement check on mount (login)
  useEffect(() => {
    if (
      currentUser &&
      isEnforcementEnabled === true &&
      !hasRunEnforcement.current
    ) {
      hasRunEnforcement.current = true;
      checkDeadlines().catch((error) => {
        console.error("Failed to check deadlines:", error);
        captureError(error);
      });
    }
  }, [currentUser, isEnforcementEnabled, checkDeadlines]);

  // Redirect to login if not authenticated (in useEffect to avoid setState during render)
  useEffect(() => {
    if (currentUser === null) {
      router.push("/login");
    }
  }, [currentUser, router]);

  // Don’t render while redirecting or checking auth
  if (currentUser === null) {
    return null;
  }

  // Loading state
  if (currentUser === undefined) {
    return (
      <div className="space-y-6">
        <div
          className="animate-in fade-in fill-mode-forwards"
          style={{ animationDuration: "0.2s" }}
        >
          <Skeleton variant="line" className="mb-3 h-4 w-32" />
          <Skeleton variant="line" className="mb-3 h-10 w-64" />
          <Skeleton variant="line" className="h-6 w-full max-w-[52ch]" />
        </div>
        <div
          className="animate-in fade-in slide-in-from-bottom-2 fill-mode-forwards"
          style={{ animationDelay: "50ms", animationDuration: "0.3s" }}
        >
          <Skeleton variant="block" className="h-48" />
        </div>
        <div
          className="animate-in fade-in slide-in-from-bottom-4 fill-mode-forwards"
          style={{ animationDelay: "100ms", animationDuration: "0.3s" }}
        >
          <Skeleton variant="block" className="h-64" />
        </div>
      </div>
    );
  }

  // Extract first name from full name
  // Extracted to local variable (React Compiler disabled; kept for SWC safety)
  const rawName = currentUser.name;
  const firstName = rawName ? rawName.split(" ")[0] : "there";

  return (
    <div className="space-y-6">
      {/* Welcome Header + Primary CTA */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="font-mono text-sm font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Dashboard
          </p>{" "}
          <h1 className="mt-2 font-heading text-3xl font-black leading-[1.08] tracking-[-0.03em] sm:text-4xl">
            Welcome back, {firstName}
          </h1>{" "}
          <p className="mt-3 max-w-[52ch] text-base leading-relaxed text-foreground/70">
            Every filing window, wage expiration and audit deadline in your
            cases, computed from the dates you have entered.
          </p>
        </div>
        <div className="shrink-0">
          <AddCaseButton />
        </div>
      </div>

      {/* Auto-closure Alert Banner - Shows when cases have been auto-closed */}
      <AutoClosureAlertBanner />

      {/* Deadline Hero Widget - Crown jewel, most prominent */}
      <DeadlineHeroWidget />

      {/* Summary Tiles Grid */}
      <QueuePulseWidget />
      <SummaryTilesGrid cornerVariant="tag" />

      {/* Onboarding Checklist - shown for new users after wizard */}
      <OnboardingChecklist />

      {/* Two-column layout: Upcoming Deadlines | Recent Activity */}
      <div className="grid grid-cols-1 gap-6 [&>*]:min-w-0 md:grid-cols-2">
        <UpcomingDeadlinesWidget />
        <RecentActivityWidget />
      </div>

      {/* Add Case Button - Full width call to action */}
      <div data-tour="add-case-button" className="flex justify-center">
        <AddCaseButton />
      </div>

    </div>
  );
}
