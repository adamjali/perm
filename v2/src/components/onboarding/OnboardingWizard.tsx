"use client";

import { useMemo, useState } from "react";
import { XIcon } from "@phosphor-icons/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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

/** What each step is, in the words its own heading uses. */
const STEP_NAMES: Record<OnboardingWizardStep, string> = {
  welcome: "Welcome",
  role: "Your role",
  create_case: "Your first case",
  value_preview: "What you get",
  completion: "Done",
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
        <DialogTitle className="sr-only">Onboarding setup</DialogTitle>
        <DialogDescription className="sr-only">Setup wizard for new users</DialogDescription>

        {/* Skip button — shown on all steps except completion */}
        {!isCompletionStep && (
          <button
            type="button"
            onClick={handleSkipWizard}
            disabled={isSkipping}
            className={cn(
              // Drawn like the dialog close control, with the app's focus ring.
              "absolute top-3 right-3 z-50",
              "inline-flex h-11 items-center gap-1.5 px-3 md:h-9",
              "font-heading text-sm font-bold text-muted-foreground",
              "border-transparent transition-colors duration-150 border",
              "hover:border-border hover:bg-accent hover:text-foreground",
              "outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
              "disabled:cursor-wait disabled:text-muted-foreground"
            )}
            aria-label="Skip setup and explore with sample data"
          >
            {isSkipping ? (
              <span className="text-sm">Setting up...</span>
            ) : (
              <>
                <span className="hidden sm:inline">Skip</span>
                <XIcon className="size-3.5" />
              </>
            )}
          </button>
        )}

        {/* Progress: one joined rail, filled to the step you're on, with the step said in words. Five
            loose dots had said neither which step this was nor that the steps run in one line. */}
        <div className="flex flex-shrink-0 flex-col items-center gap-2 px-4 pt-4 pb-2 sm:px-6 sm:pt-6">
          <p className="text-sm font-semibold text-muted-foreground">
            Step {currentIndex + 1} of {WIZARD_STEPS.length}: {STEP_NAMES[currentStep]}
          </p>{" "}
          <ol aria-label="Setup steps" className="flex w-full max-w-xs border-2 border-input">
            {WIZARD_STEPS.map((s, i) => (
              <li
                key={s}
                aria-current={i === currentIndex ? "step" : undefined}
                className={cn(
                  "h-2 flex-1",
                  i > 0 && "border-l-2 border-background",
                  i <= currentIndex ? "bg-primary-text" : "bg-muted",
                )}
              >
                <span className="sr-only">
                  {`${STEP_NAMES[s]}${i < currentIndex ? ", done" : i === currentIndex ? ", this step" : ""} `}
                </span>
              </li>
            ))}
          </ol>
        </div>

        {/* Step content — scrollable with generous max height */}
        <div className="px-4 sm:px-6 pb-6 sm:pb-8 pt-2 sm:pt-4 overflow-y-auto flex-1 min-h-0">
          <>
            <div
              key={currentStep}
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
            </div>
          </>
        </div>
      </DialogContent>
    </Dialog>
  );
}
