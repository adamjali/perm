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
import type { OnboardingContextValue, OnboardingStep, TourPhase } from "@/lib/onboarding/types";
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
  const hasCases = useQuery(api.cases.hasAnyCases);
  // Removed hasAnyCaseDates — too eager for existing users with cases.
  // "add_dates" is auto-completed when user visits a case detail page instead.

  const updateStep = useMutation(api.onboarding.updateOnboardingStep);
  const completeItem = useMutation(api.onboarding.completeChecklistItem);
  const dismissMutation = useMutation(api.onboarding.dismissChecklist);

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

  // Determine current step
  const step: OnboardingStep = useMemo(() => {
    if (onboardingState === undefined || onboardingState === null) return null;
    return (onboardingState.onboardingStep as OnboardingStep) ?? null;
  }, [onboardingState]);

  const isLoading = onboardingState === undefined || hasCases === undefined;

  // Skip logic: existing users with cases or completed onboarding don't see anything
  const shouldSkipOnboarding = useMemo(() => {
    if (isLoading) return true;
    if (onboardingState === null) return true;
    if (onboardingState.onboardingCompletedAt !== null) return false;
    if (onboardingState.onboardingStep !== null) return false;
    if (hasCases === true) return true;
    if (onboardingState.termsAcceptedAt === null) return true;
    return false;
  }, [isLoading, onboardingState, hasCases]);

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
    shouldSkipOnboarding && onboardingState?.onboardingCompletedAt === null
      ? true
      : completedChecklistItems.includes("dismissed");

  // --- Actions ---

  const advanceWizardStep = useCallback(
    async (newStep: string) => {
      await updateStep({ step: newStep });
    },
    [updateStep]
  );

  const startTour = useCallback(() => {
    setWizardDismissed(true); // Close wizard immediately (don't wait for DB)
    setTourActive(true);
    setTourPhase("dashboard");
    updateStep({ step: "tour_pending" });
  }, [updateStep]);

  const skipTour = useCallback(() => {
    setWizardDismissed(true); // Close wizard immediately (don't wait for DB)
    setTourActive(false);
    setTourPhase(null);
    updateStep({ step: "tour_completed" });
  }, [updateStep]);

  const advanceTourPhase = useCallback(() => {
    if (tourPhase === null) return;
    const currentIndex = TOUR_PHASE_ORDER.indexOf(tourPhase);
    const nextIndex = currentIndex + 1;
    if (nextIndex >= TOUR_PHASE_ORDER.length) {
      // Tour complete
      setTourActive(false);
      setTourPhase(null);
      updateStep({ step: "tour_completed" });
    } else {
      setTourPhase(TOUR_PHASE_ORDER[nextIndex] ?? null);
    }
  }, [tourPhase, updateStep]);

  const completeChecklistItem = useCallback(
    async (itemId: string) => {
      await completeItem({ itemId });
    },
    [completeItem]
  );

  const dismissChecklist = useCallback(async () => {
    await dismissMutation({});
  }, [dismissMutation]);

  // --- Auto-complete checklist items based on page visits ---
  useEffect(() => {
    if (isChecklistDismissed || isLoading || shouldSkipOnboarding) return;
    if (onboardingState?.onboardingCompletedAt === null) return;

    const path = pathname;
    if (completedPaths.current.has(path)) return;
    completedPaths.current.add(path);

    if (path === "/calendar" && !completedChecklistItems.includes("explore_calendar")) {
      completeItem({ itemId: "explore_calendar" });
    }
    if (path === "/settings" && !completedChecklistItems.includes("setup_notifications")) {
      completeItem({ itemId: "setup_notifications" });
    }
    if (path === "/settings" && !completedChecklistItems.includes("explore_settings")) {
      completeItem({ itemId: "explore_settings" });
    }
    // Auto-complete "add_dates" when user visits a case detail page
    if (path.match(/^\/cases\/[^/]+$/) && !completedChecklistItems.includes("add_dates")) {
      completeItem({ itemId: "add_dates" });
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

  // Activate tour if step is tour_pending
  useEffect(() => {
    if (step === "tour_pending" && !tourActive) {
      setTourActive(true);
      if (tourPhase === null) {
        setTourPhase("dashboard");
      }
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
      setOnboardingCaseId,
      setOnboardingCaseInfo,
      completeChecklistItem,
      dismissChecklist,
      startTour,
      skipTour,
      advanceTourPhase,
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
      completeChecklistItem,
      dismissChecklist,
      startTour,
      skipTour,
      advanceTourPhase,
    ]
  );

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
}
