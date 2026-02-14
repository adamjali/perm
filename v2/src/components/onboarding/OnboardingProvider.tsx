"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useQuery, useMutation } from "convex/react";
import { usePathname } from "next/navigation";
import { api } from "../../../convex/_generated/api";
import { toast } from "sonner";
import { captureError } from "@/lib/sentry";
import type { ChecklistItemId, OnboardingContextValue, OnboardingStep, TourPhase } from "@/lib/onboarding/types";
import { TOUR_PHASE_ORDER } from "@/lib/onboarding/constants";

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function useOnboarding(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext);
  if (!ctx) {
    throw new Error("useOnboarding must be used within OnboardingProvider");
  }
  return ctx;
}

/**
 * Try to get onboarding context. Returns null if not inside provider.
 * Useful for components that may or may not be within onboarding scope.
 */
export function useOnboardingOptional(): OnboardingContextValue | null {
  return useContext(OnboardingContext);
}

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const onboardingState = useQuery(api.onboarding.getOnboardingState);

  const updateStep = useMutation(api.onboarding.updateOnboardingStep);
  const completeItem = useMutation(api.onboarding.completeChecklistItem);
  const dismissMutation = useMutation(api.onboarding.dismissChecklist);
  const restartTourMutation = useMutation(api.onboarding.restartTour);
  const createSampleCaseMutation = useMutation(api.onboarding.createSampleCase);

  // Tour state
  const [tourActive, setTourActive] = useState(false);
  const [tourPhase, setTourPhase] = useState<TourPhase>(null);

  // Local flag to close wizard immediately (before DB round-trip)
  const [wizardDismissed, setWizardDismissed] = useState(false);

  // Track case created during wizard
  const [onboardingCaseId, setOnboardingCaseId] = useState<string | null>(null);
  const [onboardingCaseInfo, setOnboardingCaseInfo] = useState<{
    employerName: string;
    positionTitle: string;
  } | null>(null);

  // Track which paths have been visited for checklist auto-completion
  const completedPaths = useRef(new Set<string>());

  // Guard: prevent auto-activation useEffect from re-triggering after skip/complete
  // (DB step may still be "tour_pending" until the mutation lands)
  const tourEndedRef = useRef(false);

  // Determine current step
  const step: OnboardingStep = useMemo(() => {
    if (onboardingState === undefined || onboardingState === null) return null;
    return (onboardingState.onboardingStep as OnboardingStep) ?? null;
  }, [onboardingState]);

  const isLoading = onboardingState === undefined;

  // Skip logic: only skip while loading, no profile, or waiting for terms acceptance.
  // Once terms are accepted, onboarding shows for ALL users who haven't completed it.
  const shouldSkipOnboarding = useMemo(() => {
    if (isLoading) return true;
    if (onboardingState === null) return true;
    // Already completed → don't skip (show checklist)
    if (onboardingState.onboardingCompletedAt !== null) return false;
    // In progress → don't skip (show wizard/tour)
    if (onboardingState.onboardingStep !== null) return false;
    // Defer to PendingTermsHandler until terms are accepted
    if (onboardingState.termsAcceptedAt === null) return true;
    // New user, terms accepted, not started → show onboarding
    return false;
  }, [isLoading, onboardingState]);

  // Show wizard when: not skipping AND step is null or a wizard step
  const showWizard = useMemo(() => {
    if (wizardDismissed) return false;
    if (shouldSkipOnboarding) return false;
    if (step === null) return true;
    return ["welcome", "role", "create_case", "value_preview", "completion"].includes(step);
  }, [wizardDismissed, shouldSkipOnboarding, step]);

  // Tour is active when tourActive is true (not page-restricted — tour handles navigation)
  const showTour = tourActive;

  // Checklist state
  const completedChecklistItems = onboardingState?.onboardingChecklist ?? [];
  const isChecklistDismissed =
    (shouldSkipOnboarding && onboardingState?.onboardingCompletedAt === null) ||
    (onboardingState?.onboardingChecklistDismissed ?? false);

  // --- Actions ---

  const advanceWizardStep = useCallback(
    async (newStep: NonNullable<OnboardingStep>) => {
      try {
        await updateStep({ step: newStep });
      } catch (error) {
        console.error("Failed to advance wizard step:", error);
        captureError(error, { operation: "advanceWizardStep" });
        toast.error("Something went wrong. Please try again.");
      }
    },
    [updateStep]
  );

  const skipWizard = useCallback(async () => {
    try {
      // Create sample case so dashboard isn't empty
      await createSampleCaseMutation({});
      // Auto-complete the create_case checklist item
      await completeItem({ itemId: "create_case" });
      // Jump straight to completion step (tour prompt)
      setWizardDismissed(true);
      await updateStep({ step: "completion" });
      setWizardDismissed(false); // Re-show wizard at completion step
    } catch (error) {
      console.error("Failed to skip wizard:", error);
      captureError(error, { operation: "skipWizard" });
      toast.error("Something went wrong. Please try again.");
    }
  }, [createSampleCaseMutation, completeItem, updateStep]);

  const startTour = useCallback(() => {
    tourEndedRef.current = false; // Allow auto-activation
    setWizardDismissed(true); // Close wizard immediately (don't wait for DB)
    setTourActive(true);
    setTourPhase("dashboard");
    // Create sample case alongside user's own case (fire-and-forget)
    createSampleCaseMutation({}).catch((error) => {
      console.error("Failed to create sample case:", error);
      captureError(error, { operation: "startTour.createSampleCase" });
    });
    updateStep({ step: "tour_pending" }).catch((error) => {
      console.error("Failed to start tour:", error);
      captureError(error, { operation: "startTour" });
    });
  }, [updateStep, createSampleCaseMutation]);

  const skipTour = useCallback(() => {
    tourEndedRef.current = true; // Block auto-reactivation until mutation lands
    setWizardDismissed(true); // Close wizard immediately (don't wait for DB)
    setTourActive(false);
    setTourPhase(null);
    // Create sample case alongside user's own case (fire-and-forget)
    createSampleCaseMutation({}).catch((error) => {
      console.error("Failed to create sample case:", error);
      captureError(error, { operation: "skipTour.createSampleCase" });
    });
    updateStep({ step: "tour_completed" }).catch((error) => {
      console.error("Failed to skip tour:", error);
      captureError(error, { operation: "skipTour" });
    });
    toast("Tour skipped. You can replay it anytime from Settings \u2192 Support.", { icon: "\uD83D\uDCA1" });
  }, [updateStep, createSampleCaseMutation]);

  const advanceTourPhase = useCallback(() => {
    if (tourPhase === null) return;
    const currentIndex = TOUR_PHASE_ORDER.indexOf(tourPhase);
    const nextIndex = currentIndex + 1;
    if (nextIndex >= TOUR_PHASE_ORDER.length) {
      // Tour complete
      tourEndedRef.current = true; // Block auto-reactivation until mutation lands
      setTourActive(false);
      setTourPhase(null);
      updateStep({ step: "tour_completed" }).catch((error) => {
        console.error("Failed to complete tour:", error);
        captureError(error, { operation: "completeTour" });
      });
      toast.success("Tour complete! You can replay it anytime from Settings \u2192 Support.");
    } else {
      setTourPhase(TOUR_PHASE_ORDER[nextIndex] ?? null);
    }
  }, [tourPhase, updateStep]);

  const completeChecklistItem = useCallback(
    async (itemId: ChecklistItemId) => {
      await completeItem({ itemId });
    },
    [completeItem]
  );

  const dismissChecklist = useCallback(async () => {
    await dismissMutation({});
  }, [dismissMutation]);

  const restartTour = useCallback(async () => {
    try {
      tourEndedRef.current = false; // Allow auto-activation
      await restartTourMutation({});
      setTourActive(true);
      setTourPhase("dashboard");
    } catch (error) {
      console.error("Failed to restart tour:", error);
      captureError(error, { operation: "restartTour" });
      toast.error("Failed to restart tour");
    }
  }, [restartTourMutation]);

  // --- Auto-complete checklist items based on page visits ---
  useEffect(() => {
    if (isChecklistDismissed || isLoading || shouldSkipOnboarding) return;
    if (onboardingState?.onboardingCompletedAt === null) return;

    if (completedPaths.current.has(pathname)) return;
    completedPaths.current.add(pathname);

    // Map paths to checklist items they auto-complete
    const pathToItems: Record<string, string[]> = {
      "/calendar": ["explore_calendar"],
      "/settings": ["setup_notifications", "explore_settings"],
    };

    const itemsForPath = pathToItems[pathname] ?? [];

    // Case detail pages auto-complete "add_dates"
    if (/^\/cases\/[^/]+$/.test(pathname)) {
      itemsForPath.push("add_dates");
    }

    for (const itemId of itemsForPath) {
      if (!completedChecklistItems.includes(itemId)) {
        completeItem({ itemId: itemId as "explore_calendar" | "setup_notifications" | "explore_settings" | "add_dates" }).catch((error) => {
          console.error(`Failed to auto-complete checklist item ${itemId}:`, error);
          captureError(error, { operation: "autoCompleteChecklist", extra: { itemId } });
        });
      }
    }
  }, [
    pathname,
    isChecklistDismissed,
    isLoading,
    shouldSkipOnboarding,
    onboardingState,
    completedChecklistItems,
    completeItem,
  ]);

  // Activate tour if step is tour_pending (e.g. page reload mid-tour)
  // Guard: tourEndedRef prevents re-activation during the gap between
  // skipTour()/advanceTourPhase() and the DB mutation landing
  useEffect(() => {
    if (tourEndedRef.current) return;
    if (step === "tour_pending" && !tourActive) {
      setTourActive(true);
      if (tourPhase === null) {
        setTourPhase("dashboard");
      }
    }
    // Clear the guard once DB confirms step is no longer tour_pending
    if (step !== "tour_pending") {
      tourEndedRef.current = false;
    }
  }, [step, tourActive, tourPhase]);

  const value: OnboardingContextValue = useMemo(
    () => ({
      step,
      showWizard,
      showTour,
      tourPhase,
      completedChecklistItems,
      isChecklistDismissed,
      isLoading,
      onboardingCaseId,
      onboardingCaseInfo,
      advanceWizardStep,
      skipWizard,
      setOnboardingCaseId,
      setOnboardingCaseInfo,
      completeChecklistItem,
      dismissChecklist,
      startTour,
      skipTour,
      advanceTourPhase,
      restartTour,
    }),
    [
      step,
      showWizard,
      showTour,
      tourPhase,
      completedChecklistItems,
      isChecklistDismissed,
      isLoading,
      onboardingCaseId,
      onboardingCaseInfo,
      advanceWizardStep,
      skipWizard,
      completeChecklistItem,
      dismissChecklist,
      startTour,
      skipTour,
      advanceTourPhase,
      restartTour,
    ]
  );

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
}
