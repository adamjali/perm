"use client";

import { SuccessCelebrationSVG } from "@/components/illustrations";
import { Button } from "@/components/ui/button";
import { useOnboarding } from "../OnboardingProvider";

interface CompletionStepProps {
  onTakeTour: () => void;
  onSkip: () => void;
}

export function CompletionStep({ onTakeTour, onSkip }: CompletionStepProps) {
  const { onboardingCaseInfo } = useOnboarding();

  return (
    <div className="flex flex-col items-center text-center px-2">
      <div className="mb-6">
        <SuccessCelebrationSVG className="w-32 h-32 sm:w-40 sm:h-40" />
      </div>

      <h2 className="font-heading text-2xl sm:text-3xl font-bold mb-2">
        You&apos;re all set!
      </h2>

      {onboardingCaseInfo && (
        <div className="inline-flex items-center gap-2 px-4 py-2 mb-4 border-2 border-border bg-primary/10 shadow-hard-sm">
          <span className="text-sm">
            <span className="font-heading font-semibold">
              {onboardingCaseInfo.employerName}
            </span>
            {" \u2014 "}
            <span className="text-muted-foreground">
              {onboardingCaseInfo.positionTitle}
            </span>
          </span>
        </div>
      )}

      <p className="text-muted-foreground text-sm max-w-xs mb-8">
        Your first case is ready. Take a quick tour to see where everything is,
        or jump straight into your dashboard.
      </p>

      <div className="w-full max-w-sm space-y-3">
        <Button
          onClick={onTakeTour}
          size="lg"
          className="w-full uppercase tracking-wider font-heading text-sm"
        >
          Take a Quick Tour
        </Button>

        <Button
          onClick={onSkip}
          variant="ghost"
          size="lg"
          className="w-full text-muted-foreground text-sm"
        >
          Skip, I&apos;ll explore on my own
        </Button>
      </div>
    </div>
  );
}
