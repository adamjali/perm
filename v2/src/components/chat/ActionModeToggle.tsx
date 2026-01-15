/**
 * ActionModeToggle Component
 *
 * Segmented control for switching between chatbot action modes:
 * - OFF: Read-only mode, chatbot only answers questions
 * - CONFIRM: Chatbot proposes actions and waits for confirmation (default, safest)
 * - AUTO: Chatbot executes actions automatically
 *
 * Neobrutalist design:
 * - 2px black border container
 * - Hard shadow (2px 2px 0px)
 * - Active segment: Forest Green bg, white text
 * - Inactive: white bg, black text with hover state
 * - Icons only (tooltips explain functionality)
 *
 * @module components/chat/ActionModeToggle
 */

"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { EyeOff, ShieldCheck, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActionMode } from "@/lib/ai/tool-permissions";

// Re-export for consumers
export type { ActionMode };

export interface ActionModeToggleProps {
  /** Current action mode */
  mode: ActionMode;
  /** Callback when mode changes */
  onChange: (mode: ActionMode) => void;
  /** Whether the toggle is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

interface ModeConfig {
  icon: typeof EyeOff;
  label: string;
  tooltip: string;
}

const MODE_CONFIG: Record<ActionMode, ModeConfig> = {
  off: {
    icon: EyeOff,
    label: "OFF",
    tooltip: "Read-only mode - I'll only answer questions",
  },
  confirm: {
    icon: ShieldCheck,
    label: "CONFIRM",
    tooltip: "I'll ask before taking actions",
  },
  auto: {
    icon: Zap,
    label: "AUTO",
    tooltip: "I'll act immediately (destructive actions still ask)",
  },
};

const MODES: ActionMode[] = ["off", "confirm", "auto"];

// ============================================================================
// Tooltip Component (Portal-based)
// ============================================================================

interface TooltipPortalProps {
  children: React.ReactNode;
  targetRef: React.RefObject<HTMLElement | null>;
  visible: boolean;
}

function TooltipPortal({ children, targetRef, visible }: TooltipPortalProps) {
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (visible && targetRef.current) {
      const rect = targetRef.current.getBoundingClientRect();
      setPosition({
        top: rect.top - 8, // 8px above the element
        left: rect.left + rect.width / 2, // centered
      });
    }
  }, [visible, targetRef]);

  if (!mounted || !visible) return null;

  return createPortal(
    <AnimatePresence>
      {visible && (
        <motion.div
          className={cn(
            "fixed z-[9999] -translate-x-1/2 -translate-y-full",
            "px-2 py-1.5 bg-foreground text-background text-xs font-medium",
            "whitespace-nowrap shadow-hard-sm",
            "pointer-events-none",
            "border-2 border-foreground"
          )}
          style={{ top: position.top, left: position.left }}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          transition={{ duration: 0.15 }}
        >
          {children}
          {/* Arrow pointer */}
          <div
            className="absolute top-full left-1/2 -translate-x-1/2
            border-4 border-transparent border-t-foreground"
          />
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

// ============================================================================
// Component
// ============================================================================

export function ActionModeToggle({
  mode,
  onChange,
  disabled = false,
  className,
}: ActionModeToggleProps) {
  const [hoveredMode, setHoveredMode] = useState<ActionMode | null>(null);
  const buttonRefs = useRef<Map<ActionMode, HTMLButtonElement>>(new Map());

  const handleClick = useCallback(
    (newMode: ActionMode) => {
      if (!disabled && newMode !== mode) {
        onChange(newMode);
      }
    },
    [disabled, mode, onChange]
  );

  // Stable ref callback that extracts mode from data attribute
  // This avoids calling a function during render which would access refs
  const handleButtonRef = useCallback((el: HTMLButtonElement | null) => {
    if (el) {
      const modeAttr = el.dataset.mode as ActionMode | undefined;
      if (modeAttr) {
        buttonRefs.current.set(modeAttr, el);
      }
    }
  }, []);

  /* eslint-disable react-hooks/refs -- Ref access for tooltip positioning is safe and necessary */
  return (
    <div
      className={cn(
        // Container styling
        "relative inline-flex",
        "border-2 border-border bg-background",
        "shadow-[2px_2px_0px_#000]",
        // Disabled state
        disabled && "opacity-50 pointer-events-none",
        className
      )}
      role="radiogroup"
      aria-label="Action mode"
    >
      {MODES.map((m) => {
        const config = MODE_CONFIG[m];
        const Icon = config.icon;
        const isActive = mode === m;
        const isHovered = hoveredMode === m;

        return (
          <div
            key={m}
            className="relative"
            onMouseEnter={() => setHoveredMode(m)}
            onMouseLeave={() => setHoveredMode(null)}
          >
            <button
              ref={handleButtonRef}
              data-mode={m}
              type="button"
              role="radio"
              aria-checked={isActive}
              aria-label={config.tooltip}
              onClick={() => handleClick(m)}
              disabled={disabled}
              className={cn(
                // Base segment styling - icons only, compact
                "relative flex items-center justify-center",
                "w-9 h-8",
                "transition-colors duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                // Border between segments (not on last)
                "border-r-2 border-border last:border-r-0",
                // Active state - Forest Green
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-foreground hover:bg-muted"
              )}
            >
              {/* Scale pulse on active change */}
              <motion.span
                initial={false}
                animate={{
                  scale: isActive ? [1, 1.15, 1] : 1,
                }}
                transition={{
                  duration: 0.2,
                  ease: "easeOut",
                }}
              >
                <Icon className="h-4 w-4" />
              </motion.span>
            </button>

            {/* Portal-based Tooltip */}
            <TooltipPortal
              targetRef={{ current: buttonRefs.current.get(m) ?? null }}
              visible={isHovered && !disabled}
            >
              {config.tooltip}
            </TooltipPortal>
          </div>
        );
      })}
    </div>
  );
}
