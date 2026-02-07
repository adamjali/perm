"use client";

import { useEffect, useRef, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import { TOUR_PHASES } from "@/lib/onboarding/constants";
import type { TourPhase } from "@/lib/onboarding/types";

interface OnboardingTourProps {
  active: boolean;
  tourPhase: TourPhase;
  onPhaseComplete: () => void;
  onTourSkip: () => void;
}

export function OnboardingTour({
  active,
  tourPhase,
  onPhaseComplete,
  onTourSkip,
}: OnboardingTourProps) {
  const router = useRouter();
  const pathname = usePathname();
  const driverRef = useRef<ReturnType<typeof driver> | null>(null);
  const hasStartedPhase = useRef<string | null>(null);

  const cleanup = useCallback(() => {
    if (driverRef.current) {
      driverRef.current.destroy();
      driverRef.current = null;
    }
  }, []);

  // Start Driver.js for the current phase when we're on the right page
  useEffect(() => {
    if (!active || tourPhase === null) return;

    const phaseConfig = TOUR_PHASES.find((p) => p.phase === tourPhase);
    if (!phaseConfig) return;

    // Check if we're on the right page for this phase
    if (pathname !== phaseConfig.page) {
      router.push(phaseConfig.page);
      return;
    }

    // Don't re-start the same phase
    if (hasStartedPhase.current === tourPhase) return;
    hasStartedPhase.current = tourPhase;

    // Poll for DOM elements — dashboard may still be loading data
    let attempts = 0;
    const maxAttempts = 8;
    const pollInterval = 500; // check every 500ms

    const pollTimer = setInterval(() => {
      attempts++;

      // Filter steps to only those with existing DOM elements
      const availableSteps: DriveStep[] = phaseConfig.steps
        .filter((step) => document.querySelector(step.element) !== null)
        .map((step) => ({
          element: step.element,
          popover: {
            title: step.title,
            description: step.description,
            side: "bottom" as const,
            align: "start" as const,
          },
        }));

      // Keep waiting if no elements found yet (page still loading)
      if (availableSteps.length === 0) {
        if (attempts >= maxAttempts) {
          clearInterval(pollTimer);
          onPhaseComplete(); // Give up, skip phase
        }
        return;
      }

      clearInterval(pollTimer);
      cleanup();

      const phaseIndex = TOUR_PHASES.findIndex((p) => p.phase === tourPhase);
      const totalPhases = TOUR_PHASES.length;
      const isLastPhase = phaseIndex === totalPhases - 1;

      const isMobile = window.innerWidth < 640;

      const driverObj = driver({
        showProgress: true,
        animate: true,
        allowClose: true,
        overlayColor: "rgba(0, 0, 0, 0.6)",
        stagePadding: isMobile ? 4 : 10,
        stageRadius: 0,
        popoverClass: "neo-popover",
        progressText: `Step {{current}}/{{total}} \u2022 ${phaseConfig.phase?.charAt(0).toUpperCase()}${phaseConfig.phase?.slice(1)}`,
        nextBtnText: "Next \u2192",
        prevBtnText: "\u2190 Back",
        doneBtnText: isLastPhase ? "Finish Tour \u2713" : "Continue \u2192",
        onDestroyStarted: () => {
          driverObj.destroy();
          driverRef.current = null;
          // If user completed all steps in this phase, advance
          if (!driverObj.hasNextStep() || driverObj.isLastStep()) {
            onPhaseComplete();
          } else {
            // User closed early (X button or overlay click)
            onTourSkip();
          }
        },
        steps: availableSteps,
      });

      driverRef.current = driverObj;
      driverObj.drive();
    }, pollInterval);

    return () => {
      clearInterval(pollTimer);
      // Reset ref so React strict mode re-run can start the poll again
      hasStartedPhase.current = null;
    };
  }, [active, tourPhase, pathname, router, cleanup, onPhaseComplete, onTourSkip]);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return null;
}
