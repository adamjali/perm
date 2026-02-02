/**
 * ViewToggle Component
 *
 * Segmented control for switching between card and list views.
 * Neobrutalist design matching ActionModeToggle pattern.
 *
 * @module components/cases/ViewToggle
 */

"use client";

import { useCallback, useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";

export type ViewMode = "card" | "list";

export interface ViewToggleProps {
  /** Current view mode */
  view: ViewMode;
  /** Callback when view changes */
  onChange: (view: ViewMode) => void;
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

interface ViewConfig {
  icon: typeof LayoutGrid;
  label: string;
  tooltip: string;
}

const VIEW_CONFIG: Record<ViewMode, ViewConfig> = {
  card: {
    icon: LayoutGrid,
    label: "Card",
    tooltip: "Card view",
  },
  list: {
    icon: List,
    label: "List",
    tooltip: "List view",
  },
};

const VIEWS: ViewMode[] = ["card", "list"];

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
        top: rect.top - 8,
        left: rect.left + rect.width / 2,
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

export function ViewToggle({ view, onChange, className }: ViewToggleProps) {
  const [hoveredView, setHoveredView] = useState<ViewMode | null>(null);
  const cardButtonRef = useRef<HTMLButtonElement>(null);
  const listButtonRef = useRef<HTMLButtonElement>(null);

  const getButtonRef = (v: ViewMode) =>
    v === "card" ? cardButtonRef : listButtonRef;

  const handleClick = useCallback(
    (newView: ViewMode) => {
      if (newView !== view) {
        onChange(newView);
      }
    },
    [view, onChange]
  );

  return (
    <div
      className={cn(
        // Container styling - neobrutalist
        "relative inline-flex",
        "border-2 border-border bg-background",
        "shadow-[2px_2px_0px_#000]",
        className
      )}
      role="radiogroup"
      aria-label="View mode"
    >
      {VIEWS.map((v) => {
        const config = VIEW_CONFIG[v];
        const Icon = config.icon;
        const isActive = view === v;
        const isHovered = hoveredView === v;

        return (
          <div
            key={v}
            className="relative"
            onMouseEnter={() => setHoveredView(v)}
            onMouseLeave={() => setHoveredView(null)}
          >
            <button
              ref={getButtonRef(v)}
              type="button"
              role="radio"
              aria-checked={isActive}
              aria-label={config.tooltip}
              onClick={() => handleClick(v)}
              className={cn(
                // Base segment styling
                "relative flex items-center justify-center",
                "w-9 h-8",
                "transition-colors duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                // Border between segments
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
              targetRef={getButtonRef(v)}
              visible={isHovered}
            >
              {config.tooltip}
            </TooltipPortal>
          </div>
        );
      })}
    </div>
  );
}
