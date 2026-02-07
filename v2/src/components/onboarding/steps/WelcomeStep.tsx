"use client";

import { RocketLaunchSVG } from "@/components/illustrations";
import { Button } from "@/components/ui/button";
import { Clock, Calendar, FolderOpen } from "lucide-react";

interface WelcomeStepProps {
  onNext: () => void;
}

const VALUE_PROPS = [
  {
    icon: Clock,
    text: "Automated deadline tracking",
    detail: "Never miss a PWD expiration or filing window",
  },
  {
    icon: Calendar,
    text: "Filing window calculations",
    detail: "Dates auto-computed from your case data",
  },
  {
    icon: FolderOpen,
    text: "Multi-case management",
    detail: "Track every case from PWD through I-140",
  },
] as const;

export function WelcomeStep({ onNext }: WelcomeStepProps) {
  return (
    <div className="flex flex-col items-center text-center px-2">
      <div className="mb-6">
        <RocketLaunchSVG className="w-32 h-32 sm:w-40 sm:h-40" />
      </div>

      <h2 className="font-heading text-2xl sm:text-3xl font-bold mb-2">
        Welcome to PERM Tracker
      </h2>
      <p className="text-muted-foreground text-sm sm:text-base max-w-md mb-8">
        Track every PERM deadline, never miss a filing window, and keep all your
        cases organized in one place.
      </p>

      <div className="w-full max-w-sm space-y-3 mb-8">
        {VALUE_PROPS.map((item) => (
          <div
            key={item.text}
            className="flex items-start gap-3 text-left p-3 border-2 border-border bg-card shadow-hard-sm"
          >
            <div className="flex-shrink-0 w-9 h-9 flex items-center justify-center bg-primary/10 border-2 border-border">
              <item.icon className="w-4 h-4 text-primary" strokeWidth={2.5} />
            </div>
            <div className="min-w-0">
              <p className="font-heading font-semibold text-sm">{item.text}</p>
              <p className="text-xs text-muted-foreground">{item.detail}</p>
            </div>
          </div>
        ))}
      </div>

      <Button
        onClick={onNext}
        size="lg"
        className="w-full max-w-sm uppercase tracking-wider font-heading text-sm"
      >
        Get Started
      </Button>
    </div>
  );
}
