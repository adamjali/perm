"use client";

import { useEffect, useRef } from "react";
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
      });
    }
  }, [currentUser, isEnforcementEnabled, checkDeadlines]);

  // Redirect to login if not authenticated (in useEffect to avoid setState during render)
  useEffect(() => {
    if (currentUser === null) {
      router.push("/login");
    }
  }, [currentUser, router]);

  // Don't render while redirecting or checking auth
  if (currentUser === null) {
    return null;
  }

  // Loading state
  if (currentUser === undefined) {
    return (
      <div className="space-y-8">
        <div
          className="animate-in fade-in fill-mode-forwards"
          style={{ animationDuration: "0.2s" }}
        >
          <Skeleton variant="line" className="w-48 h-10 mb-2" />
          <Skeleton variant="line" className="w-64 h-6" />
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
  const firstName = currentUser.name?.split(" ")[0] || "there";

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div>
        <h1 className="font-heading text-3xl font-bold">
          Welcome back, {firstName}
        </h1>
        <p className="text-muted-foreground mt-1">
          Overview of your PERM cases
        </p>
      </div>

      {/* Auto-closure Alert Banner - Shows when cases have been auto-closed */}
      <AutoClosureAlertBanner />

      {/* Deadline Hero Widget - Crown jewel, most prominent */}
      <DeadlineHeroWidget />

      {/* Summary Tiles Grid */}
      <SummaryTilesGrid cornerVariant="tag" />

      {/* Two-column layout: Upcoming Deadlines | Recent Activity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <UpcomingDeadlinesWidget />
        <RecentActivityWidget />
      </div>

      {/* Add Case Button - Full width call to action */}
      <div className="flex justify-center">
        <AddCaseButton />
      </div>
    </div>
  );
}
