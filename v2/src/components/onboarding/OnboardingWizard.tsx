"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { useOnboarding } from "./OnboardingProvider";
import { WelcomeStep } from "./steps/WelcomeStep";
import { RoleStep } from "./steps/RoleStep";
import { CreateCaseStep } from "./steps/CreateCaseStep";
import { ValuePreviewStep } from "./steps/ValuePreviewStep";
import { CompletionStep } from "./steps/CompletionStep";
import type { OnboardingWizardStep } from "@/lib/onboarding/types";
import { cn } from "@/lib/utils";

const WIZARD_STEPS: OnboardingWizardStep[] = [
  "welcome",
  "role",
  "create_case",
  "value_preview",
  "completion",
];

const stepVariants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.4, 0, 0.2, 1] as const },
  },
  exit: {
    opacity: 0,
    y: -20,
    transition: { duration: 0.2, ease: [0.4, 0, 1, 1] as const },
  },
};

export function OnboardingWizard() {
  const { step, showWizard, advanceWizardStep, skipWizard, startTour, skipTour } =
    useOnboarding();

  const [isSkipping, setIsSkipping] = useState(false);

  const currentStep: OnboardingWizardStep = useMemo(() => {
    if (step === null || !WIZARD_STEPS.includes(step as OnboardingWizardStep)) {
      return "welcome";
    }
    return step as OnboardingWizardStep;
  }, [step]);

  const currentIndex = WIZARD_STEPS.indexOf(currentStep);
  const isCompletionStep = currentStep === "completion";

  const handleSkipWizard = async () => {
    setIsSkipping(true);
    try {
      await skipWizard();
    } finally {
      setIsSkipping(false);
    }
  };

  if (!showWizard) return null;

  return (
    <Dialog open={true} onOpenChange={() => {}}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-xl md:max-w-2xl max-h-[calc(100dvh-2rem)] p-0 gap-0 overflow-hidden flex flex-col"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogTitle className="sr-only">Onboarding Setup</DialogTitle>

        {/* Skip button — shown on all steps except completion */}
        {!isCompletionStep && (
          <button
            type="button"
            onClick={handleSkipWizard}
            disabled={isSkipping}
            className={cn(
              "absolute top-3 right-3 z-50",
              "flex items-center gap-1.5 px-2.5 py-1.5",
              "text-xs font-mono font-medium uppercase tracking-wider",
              "text-muted-foreground/70 hover:text-foreground",
              "border border-transparent hover:border-border",
              "transition-all duration-150",
              "hover:bg-muted hover:shadow-hard-sm",
              "disabled:opacity-50 disabled:cursor-wait"
            )}
            aria-label="Skip setup and explore with sample data"
          >
            {isSkipping ? (
              <span className="text-xs">Setting up...</span>
            ) : (
              <>
                <span className="hidden sm:inline">Skip</span>
                <X className="size-3.5" />
              </>
            )}
          </button>
        )}

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 pt-4 sm:pt-6 pb-2 px-4 sm:px-6 flex-shrink-0">
          {WIZARD_STEPS.map((s, i) => (
            <div
              key={s}
              className={cn(
                "w-2.5 h-2.5 border-2 border-border transition-colors duration-200",
                i < currentIndex
                  ? "bg-primary"
                  : i === currentIndex
                    ? "bg-primary shadow-hard-sm"
                    : "bg-muted"
              )}
            />
          ))}
        </div>

        {/* Step content — scrollable with generous max height */}
        <div className="px-4 sm:px-6 pb-6 sm:pb-8 pt-2 sm:pt-4 overflow-y-auto flex-1 min-h-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              variants={stepVariants}
              initial="hidden"
              animate="show"
              exit="exit"
            >
              {currentStep === "welcome" && (
                <WelcomeStep onNext={() => advanceWizardStep("role")} />
              )}
              {currentStep === "role" && (
                <RoleStep onNext={() => advanceWizardStep("create_case")} />
              )}
              {currentStep === "create_case" && (
                <CreateCaseStep onNext={() => advanceWizardStep("value_preview")} />
              )}
              {currentStep === "value_preview" && (
                <ValuePreviewStep onNext={() => advanceWizardStep("completion")} />
              )}
              {currentStep === "completion" && (
                <CompletionStep
                  onTakeTour={startTour}
                  onSkip={skipTour}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}
