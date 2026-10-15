"use client";

import { useRouter } from "next/navigation";
import { CaretRightIcon, CheckIcon, XIcon } from "@phosphor-icons/react";
import { useOnboarding } from "./OnboardingProvider";
import { CHECKLIST_ITEMS } from "@/lib/onboarding/constants";
import { cn } from "@/lib/utils";
import { handleOperationError } from "@/lib/errors";

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

  const handleItemClick = (itemId: string, href?: string) => {
    if (itemId === "try_assistant") {
      window.dispatchEvent(new CustomEvent("open-chat-widget"));
      return;
    }
    if (href) {
      router.push(href);
    }
  };

  return (
    <section data-tour="onboarding-checklist" className="border border-border bg-card">
      <div className="flex items-start justify-between p-4 pb-3">
        <div>
          <h2 className="font-heading text-xl font-bold">Getting started</h2>{" "}
          <p className="text-sm text-muted-foreground">
            Complete these steps to get the most out of PERM Tracker
          </p>
        </div>
        <button
          type="button"
          onClick={async () => {
            try {
              await dismissChecklist();
            } catch (error) {
              handleOperationError(error, {
                userMessage: "Couldn’t dismiss the checklist. Try again.",
                context: { operation: "dismissChecklist" },
              });
            }
          }}
          className="flex-shrink-0 p-2 -mr-1 min-w-[44px] min-h-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Dismiss checklist"
        >
          <XIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="mx-4 mb-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm font-semibold">
            {completedCount}/{totalCount} complete
          </span>{" "}
          <span className="text-sm text-muted-foreground">
            {progressPercent}%
          </span>
        </div>
        <div className="h-1.5 bg-muted">
          <div className="h-full bg-primary-text" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      {/* Checklist items */}
      <div className="px-4 pb-4 space-y-1">
        {CHECKLIST_ITEMS.map((item) => {
          const isComplete = completedChecklistItems.includes(item.id);
          const isClickable = !isComplete && (!!item.href || item.id === "try_assistant");

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleItemClick(item.id, item.href)}
              disabled={!isClickable}
              className={cn(
                "w-full flex items-center gap-3 p-2.5 min-h-[44px] text-left transition-colors duration-150",
                isClickable ? "cursor-pointer hover:bg-muted" : "cursor-default"
              )}
            >
              {/* Checkbox */}
              <div
                className={cn(
                  "flex-shrink-0 w-5 h-5 border flex items-center justify-center",
                  isComplete ? "border-primary-text bg-primary-text" : "border-input bg-card"
                )}
              >
                {isComplete && <CheckIcon className="size-3 text-background" aria-hidden="true" />}
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
                  <p className="text-sm text-muted-foreground truncate">
                    {item.description}
                  </p>
                )}
              </div>

              {/* Arrow for clickable items */}
              {isClickable && (
                <CaretRightIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
