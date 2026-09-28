"use client";

import { Button } from "@/components/ui/button";
import { PermPath } from "@/components/visuals/PermPath";

interface WelcomeStepProps {
  onNext: () => void;
}

/**
 * The first thing a new account sees: the PERM path itself, with the date the
 * app works out at each stage, instead of a list of feature claims.
 */
const PATH_NOTES = [
  { stage: "pwd", note: "Tracks when the wage expires" },
  { stage: "recruitment", note: "Counts the 30-day wait" },
  { stage: "eta9089", note: "Opens the 180-day window" },
  { stage: "i140", note: "Sets the filing deadline" },
] as const;

export function WelcomeStep({ onNext }: WelcomeStepProps) {
  return (
    <div className="flex flex-col items-center px-2 text-center">
      <h2 className="mb-2 font-heading text-2xl font-bold tracking-tight sm:text-3xl">
        Welcome to PERM Tracker
      </h2>{" "}
      <p className="mb-8 max-w-md text-sm text-muted-foreground sm:text-base">
        Enter a case&apos;s dates once. Every deadline along the path is worked out for you.
      </p>

      <PermPath steps={PATH_NOTES.map((s) => ({ ...s }))} className="mb-8 w-full" />

      <Button onClick={onNext} size="lg" className="w-full max-w-sm">
        Get started
      </Button>
    </div>
  );
}
