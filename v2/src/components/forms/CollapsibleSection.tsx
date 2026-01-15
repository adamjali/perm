"use client";

import * as React from "react";
import { ChevronDown, Lock, AlertTriangle, Unlock } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { SectionState, SectionName } from "@/hooks/useSectionState";

// ============================================================================
// TYPES
// ============================================================================

export interface CollapsibleSectionProps {
  /** Section identifier */
  name: SectionName;
  /** Display title for the section */
  title: string;
  /** Current state of the section */
  state: SectionState;
  /** Callback when section is toggled open/closed */
  onToggle: () => void;
  /** Callback when user wants to override disabled state */
  onOverride: () => void;
  /** Optional icon to display next to title */
  icon?: React.ReactNode;
  /** Optional description shown below title */
  description?: string;
  /** Section content */
  children: React.ReactNode;
  /** Additional className for the container */
  className?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * CollapsibleSection Component
 *
 * A collapsible form section with dependency management.
 *
 * Features:
 * - Animated expand/collapse
 * - Visual disabled state (greyed out)
 * - Lock icon with tooltip for disabled sections
 * - Manual override button with inline warning
 * - Neobrutalist design (hard shadows, snappy animations)
 *
 * Per perm_flow.md:
 * - Sections grey out until dependencies are met
 * - Users can manually override with a warning
 */
export function CollapsibleSection({
  name,
  title,
  state,
  onToggle,
  onOverride,
  icon,
  description,
  children,
  className,
}: CollapsibleSectionProps) {
  const { isOpen, isEnabled, isManualOverride, disabledReason, overrideWarning, statusInfo } = state;

  // Can interact if enabled OR manually overridden
  const canInteract = isEnabled || isManualOverride;

  // Handle header click
  const handleHeaderClick = () => {
    if (canInteract) {
      onToggle();
    }
  };

  return (
    <div
      className={cn(
        "rounded-lg border-2 border-border transition-all duration-150",
        // Disabled visual state
        !canInteract && "opacity-50 bg-muted/30",
        // Enabled state with shadow
        canInteract && "shadow-hard hover:shadow-hard-hover",
        className
      )}
    >
      {/* Header - using div with role="button" to avoid nested button issues when override button is shown */}
      <div
        role="button"
        tabIndex={canInteract || !isEnabled ? 0 : -1}
        onClick={handleHeaderClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleHeaderClick();
          }
        }}
        className={cn(
          "flex w-full items-center justify-between p-4",
          "text-left transition-colors duration-150 rounded-t-lg",
          canInteract && "hover:bg-muted/50 cursor-pointer",
          !canInteract && !isEnabled && "cursor-default"
        )}
        aria-expanded={isOpen}
        aria-controls={`section-${name}-content`}
      >
        <div className="flex items-center gap-3">
          {/* Icon */}
          {icon && (
            <span className={cn(
              "text-muted-foreground",
              canInteract && "text-foreground"
            )}>
              {icon}
            </span>
          )}

          {/* Title and description */}
          <div>
            <h3 className={cn(
              "font-heading font-semibold text-lg",
              !canInteract && "text-muted-foreground"
            )}>
              {title}
            </h3>
            {description && (
              <p className="text-sm text-muted-foreground mt-0.5">
                {description}
              </p>
            )}
          </div>
        </div>

        {/* Right side: Status indicators and chevron */}
        <div className="flex items-center gap-2">
          {/* Status info */}
          {statusInfo && canInteract && (
            <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
              {statusInfo}
            </span>
          )}

          {/* Lock icon and override button for disabled sections */}
          {!isEnabled && !isManualOverride && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Lock className="h-4 w-4" />
                <span className="text-xs hidden sm:inline">{disabledReason}</span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onOverride();
                }}
                className="text-xs h-7 px-2 gap-1"
              >
                <Unlock className="h-3 w-3" />
                <span className="hidden sm:inline">Override</span>
              </Button>
            </div>
          )}

          {/* Chevron */}
          <span className="text-muted-foreground transition-transform duration-200">
            <ChevronDown className={cn(
              "h-5 w-5",
              isOpen && canInteract && "rotate-180"
            )} />
          </span>
        </div>
      </div>

      {/* Warning banner (shown when manually overridden) */}
      <AnimatePresence>
        {isManualOverride && overrideWarning && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="mx-4 mb-2 flex items-start gap-2 rounded-md border-2 border-yellow-500/50 bg-yellow-50 dark:bg-yellow-900/20 p-3">
              <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                {overrideWarning}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      <AnimatePresence initial={false}>
        {isOpen && canInteract && (
          <motion.div
            id={`section-${name}-content`}
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
            <div className="px-4 pb-4">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// EXPORTS
// ============================================================================

export default CollapsibleSection;
