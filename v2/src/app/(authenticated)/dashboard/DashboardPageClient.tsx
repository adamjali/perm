"use client";

import { useEffect, useRef, useState } from "react";
import { captureError } from "@/lib/sentry";
import { useQuery, useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@convex/_generated/api";
import SummaryTilesGrid from "@/components/dashboard/SummaryTilesGrid";
import DeadlineHeroWidget from "@/components/dashboard/DeadlineHeroWidget";
import RecentActivityWidget from "@/components/dashboard/RecentActivityWidget";
import UpcomingDeadlinesWidget from "@/components/dashboard/UpcomingDeadlinesWidget";
import { DashboardHeading } from "@/components/dashboard/DashboardShell";
import AutoClosureAlertBanner from "@/components/dashboard/AutoClosureAlertBanner";
import { OnboardingChecklist } from "@/components/onboarding/OnboardingChecklist";
import { QueuePulseWidget } from "@/components/dashboard/QueuePulseWidget";
import { CaseCapNotice } from "@/components/cases/CaseCapNotice";

/** An account younger than this is greeted "Welcome", not "Welcome back". */
const NEW_ACCOUNT_MS = 24 * 60 * 60 * 1000;

export function DashboardPageClient() {
  const router = useRouter();
  const currentUser = useQuery(api.users.currentUser);
  const hasRunEnforcement = useRef(false);
  // Read once per mount: the greeting only needs to know whether the account
  // is under a day old.
  const [mountedAt] = useState(() => Date.now());

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

  // Nothing waits on the user record except the greeting: every widget starts
  // its own query now, in parallel, instead of mounting only after this one
  // resolved. (It is usually already cached: the header subscribes to it.)
  const rawName = currentUser?.name;
  // No name on file greets plainly: "Welcome back, there" read as a typo.
  const firstName =
    currentUser === undefined ? undefined : rawName ? rawName.split(" ")[0] : null;

  // A brand-new account is welcomed, not welcomed back.
  const isNewAccount =
    currentUser !== undefined && mountedAt - currentUser._creationTime < NEW_ACCOUNT_MS;

  return (
    <div className="space-y-6">
      <DashboardHeading firstName={firstName} isNewAccount={isNewAccount} />

      <CaseCapNotice />

      {/* Auto-closure Alert Banner - Shows when cases have been auto-closed */}
      <AutoClosureAlertBanner />

      {/* Deadline Hero Widget - Crown jewel, most prominent */}
      <DeadlineHeroWidget />

      {/* Summary Tiles Grid */}
      <QueuePulseWidget />
      <SummaryTilesGrid />

      {/* Onboarding Checklist - shown for new users after wizard */}
      <OnboardingChecklist />

      {/* Two-column layout: Upcoming Deadlines | Recent Activity */}
      <div className="grid grid-cols-1 gap-6 [&>*]:min-w-0 md:grid-cols-2">
        <UpcomingDeadlinesWidget />
        <RecentActivityWidget />
      </div>


    </div>
  );
}
