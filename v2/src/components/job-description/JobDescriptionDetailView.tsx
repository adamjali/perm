"use client";

import { useState, useCallback } from "react";
import { FileText, Copy, Check, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "@/lib/toast";

// ============================================================================
// TYPES
// ============================================================================

export interface JobDescriptionDetailViewProps {
  /** Position title for the job description */
  positionTitle?: string;
  /** Job description text */
  description?: string;
  /** Whether section starts expanded */
  defaultOpen?: boolean;
  /** Additional className */
  className?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * JobDescriptionDetailView Component
 *
 * Read-only display of job description on case detail page.
 * Features:
 * - Collapsible section matching CaseDetailSection style
 * - Copy to clipboard button
 * - Character count
 * - Empty state when no description
 *
 * @example
 * ```tsx
 * <JobDescriptionDetailView
 *   positionTitle={caseData.jobDescriptionPositionTitle}
 *   description={caseData.jobDescription}
 * />
 * ```
 */
export function JobDescriptionDetailView({
  positionTitle,
  description,
  defaultOpen = true,
  className,
}: JobDescriptionDetailViewProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [isCopied, setIsCopied] = useState(false);

  const hasContent = description?.trim();
  const characterCount = description?.length ?? 0;

  const handleCopy = useCallback(async () => {
    if (!description) return;

    try {
      await navigator.clipboard.writeText(description);
      setIsCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  }, [description]);

  // Don't render section if no description at all
  if (!hasContent && !positionTitle) {
    return null;
  }

  return (
    <div
      className={cn(
        "rounded-lg border-2 border-border bg-card shadow-hard-sm",
        "transition-all duration-150 hover:shadow-hard hover:-translate-y-0.5",
        className
      )}
    >
      {/* Header - clickable to toggle */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex w-full items-center justify-between p-3 sm:p-4 text-left",
          "hover:bg-muted/50 transition-colors rounded-t-lg",
          !isOpen && "rounded-b-lg",
          "min-h-[48px]"
        )}
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2 sm:gap-3">
          <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
          <h3 className="font-heading font-semibold text-base sm:text-lg">
            Job Description
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {hasContent && (
            <span className="text-xs text-muted-foreground">
              {characterCount.toLocaleString()} chars
            </span>
          )}
          <ChevronDown
            className={cn(
              "h-5 w-5 text-muted-foreground transition-transform duration-200",
              isOpen && "rotate-180"
            )}
          />
        </div>
      </button>

      {/* Content - animated collapse */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              type: "spring",
              visualDuration: 0.15,
              bounce: 0.1,
            }}
            className="overflow-hidden"
          >
            <div className="p-4 pt-0 space-y-4">
              {/* Position title */}
              {positionTitle && (
                <div className="space-y-1">
                  <dt className="text-sm font-medium text-muted-foreground">
                    Position Title
                  </dt>
                  <dd className="text-sm">{positionTitle}</dd>
                </div>
              )}

              {/* Description with copy button */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <dt className="text-sm font-medium text-muted-foreground">
                    Description
                  </dt>
                  {hasContent && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopy();
                            }}
                            className="h-7 gap-1.5 text-xs"
                          >
                            {isCopied ? (
                              <Check className="h-3.5 w-3.5 text-green-600" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                            Copy
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Copy description to clipboard</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
                {hasContent ? (
                  <dd className="text-sm whitespace-pre-wrap rounded-lg border-2 border-border bg-muted/30 p-3">
                    {description}
                  </dd>
                ) : (
                  <dd className="text-sm text-muted-foreground italic">
                    No description provided
                  </dd>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default JobDescriptionDetailView;
