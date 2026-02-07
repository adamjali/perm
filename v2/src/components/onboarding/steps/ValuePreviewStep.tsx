"use client";

import { Button } from "@/components/ui/button";
import { Clock, Bell, Calendar, Bot } from "lucide-react";

interface ValuePreviewStepProps {
  onNext: () => void;
}

const FEATURES = [
  {
    icon: Clock,
    title: "Deadlines auto-calculated",
    description:
      "PWD expiration, filing windows, and I-140 deadlines are computed from your dates.",
  },
  {
    icon: Bell,
    title: "Reminders sent automatically",
    description:
      "Get email alerts at 30, 14, 7, 3, and 1 day before each deadline.",
  },
  {
    icon: Calendar,
    title: "Calendar stays in sync",
    description:
      "Deadlines appear on your calendar view. Connect Google Calendar for external sync.",
  },
  {
    icon: Bot,
    title: "AI assistant available 24/7",
    description:
      "Ask about PERM rules, your case status, or get help with next steps.",
  },
] as const;

export function ValuePreviewStep({ onNext }: ValuePreviewStepProps) {
  return (
    <div className="flex flex-col items-center px-2">
      <h2 className="font-heading text-2xl sm:text-3xl font-bold mb-1 text-center">
        Here&apos;s what happens next
      </h2>
      <p className="text-muted-foreground text-sm mb-6 text-center">
        Your case is live. Here&apos;s what PERM Tracker does for you automatically.
      </p>

      <div className="w-full max-w-sm space-y-0 mb-8">
        {FEATURES.map((feature, index) => (
          <div key={feature.title} className="flex gap-4">
            {/* Timeline line + dot */}
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center bg-primary/10 border-2 border-border">
                <feature.icon
                  className="w-4 h-4 text-primary"
                  strokeWidth={2.5}
                />
              </div>
              {index < FEATURES.length - 1 && (
                <div className="w-0.5 flex-1 bg-border min-h-[16px]" />
              )}
            </div>

            {/* Content */}
            <div className="pb-5">
              <p className="font-heading font-semibold text-sm">
                {feature.title}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {feature.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      <Button
        onClick={onNext}
        size="lg"
        className="w-full max-w-sm uppercase tracking-wider font-heading text-sm"
      >
        Continue
      </Button>
    </div>
  );
}
