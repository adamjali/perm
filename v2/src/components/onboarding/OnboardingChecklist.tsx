"use client";

import { useRouter } from "next/navigation";
import { X, Check, ChevronRight, Sparkles } from "lucide-react";
import { useOnboarding } from "./OnboardingProvider";
import { CHECKLIST_ITEMS } from "@/lib/onboarding/constants";
import { cn } from "@/lib/utils";

export function OnboardingChecklist() {
  const router = useRouter();
  const { completedChecklistItems, isChecklistDismissed, dismissChecklist } =
    useOnboarding();

  if (isChecklistDismissed) return null;

  const completedCount = CHECKLIST_ITEMS.filter((item) =>
    completedChecklistItems.includes(item.id)
  ).length;
  const totalCount = CHECKLIST_ITEMS.length;
  const progressPercent = Math.round((completedCount / totalCount) * 100);

  const handleItemClick = (href?: string) => {
    if (href) {
      router.push(href);
    }
  };

  return (
    <div
      data-tour="onboarding-checklist"
      className="relative overflow-hidden border-4 border-black dark:border-white/20 bg-card shadow-hard"
    >
      {/* Top accent stripe */}
      <div className="h-1.5 bg-primary" />

      {/* Header */}
      <div className="flex items-start justify-between p-4 pb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" strokeWidth={2.5} />
          <div>
            <h3 className="font-heading font-bold text-base">
              Getting Started
            </h3>
            <p className="text-xs text-muted-foreground">
              Complete these steps to get the most out of PERM Tracker
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => dismissChecklist()}
          className="flex-shrink-0 p-2 -mr-1 min-w-[44px] min-h-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Dismiss checklist"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="mx-4 mb-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-heading font-semibold">
            {completedCount}/{totalCount} complete
          </span>
          <span className="text-xs text-muted-foreground">
            {progressPercent}%
          </span>
        </div>
        <div className="h-2 border-2 border-border bg-muted overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Checklist items */}
      <div className="px-4 pb-4 space-y-1">
        {CHECKLIST_ITEMS.map((item) => {
          const isComplete = completedChecklistItems.includes(item.id);
          const isClickable = !isComplete && !!item.href;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleItemClick(item.href)}
              disabled={!isClickable}
              className={cn(
                "w-full flex items-center gap-3 p-2.5 min-h-[44px] text-left transition-all duration-150",
                isClickable
                  ? "hover:bg-muted cursor-pointer"
                  : "cursor-default",
                isComplete && "opacity-60"
              )}
            >
              {/* Checkbox */}
              <div
                className={cn(
                  "flex-shrink-0 w-5 h-5 border-2 flex items-center justify-center",
                  isComplete
                    ? "bg-primary border-primary"
                    : "border-border bg-background"
                )}
              >
                {isComplete && (
                  <Check
                    className="w-3 h-3 text-primary-foreground"
                    strokeWidth={3}
                  />
                )}
              </div>

              {/* Label */}
              <div className="flex-1 min-w-0">
                <p
                  className={cn(
                    "text-sm font-medium",
                    isComplete && "line-through text-muted-foreground"
                  )}
                >
                  {item.label}
                </p>
                {!isComplete && (
                  <p className="text-xs text-muted-foreground truncate">
                    {item.description}
                  </p>
                )}
              </div>

              {/* Arrow for clickable items */}
              {isClickable && (
                <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
