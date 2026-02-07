"use client";

import { useOnboarding } from "./OnboardingProvider";
import { OnboardingTour } from "./OnboardingTour";

export function OnboardingTourWrapper() {
  const { showTour, tourPhase, advanceTourPhase, skipTour } = useOnboarding();

  if (!showTour) return null;

  return (
    <OnboardingTour
      active={showTour}
      tourPhase={tourPhase}
      onPhaseComplete={advanceTourPhase}
      onTourSkip={skipTour}
    />
  );
}
