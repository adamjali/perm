"use client";

/**
 * DeadlineItem Component - V1-MATCHING compact card style.
 *
 * Layout (2-column):
 * - Left: Employer name (bold), deadline type (uppercase small)
 * - Right: Countdown (mono bold), date (small)
 *
 * Features:
 * - Links to case detail page
 * - Hazard stripes on LEFT edge for overdue items (v1 style)
 * - One-time slide-in animation (plays once, then stays)
 * - Smart hover card with portal rendering (no clipping)
 * - Neobrutalist styling (2px border, hover lift with shadow)
 *
 * V1 Reference: frontend/dist/dashboard.html (lines 219-270)
 * Updated: 2025-12-24 - Use centralized z-index, passive scroll listeners
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Z_INDEX } from "@/lib/constants/zIndex";

/**
 * Hook to detect if the device has hover capability.
 * Returns true for desktop/mouse devices, false for touch-only devices.
 * Uses the `(hover: hover)` media query which is the most reliable way
 * to detect pointer devices vs touch devices.
 */
function useHasHover(): boolean {
  const [hasHover, setHasHover] = useState(false);

  useEffect(() => {
    // Check if device supports hover (has fine pointer like mouse)
    const mediaQuery = window.matchMedia("(hover: hover)");
    setHasHover(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setHasHover(event.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return hasHover;
}
import type { DeadlineItem as DeadlineItemType } from "../../../convex/lib/dashboardTypes";

interface DeadlineItemProps {
  deadline: DeadlineItemType;
  index: number;
  /** Whether this item is currently loading (controlled by parent) */
  isLoading?: boolean;
  /** Callback when navigation starts (for parent to track loading state) */
  onNavigate?: (caseId: string) => void;
}

// Hover card position calculated from element position
interface HoverCardPosition {
  top: number;
  left: number;
  placement: "right" | "left";
}

export default function DeadlineItem({ deadline, index, isLoading = false, onNavigate }: DeadlineItemProps) {
  const router = useRouter();
  const hasHover = useHasHover();
  const [showHoverCard, setShowHoverCard] = useState(false);
  const [hoverPosition, setHoverPosition] = useState<HoverCardPosition | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  const isOverdue = deadline.urgency === "overdue";

  // Handle click - notify parent and navigate
  const handleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (isLoading) return; // Prevent double-clicks
    onNavigate?.(deadline.caseId);
    router.push(`/cases/${deadline.caseId}`);
  }, [isLoading, onNavigate, deadline.caseId, router]);

  // Calculate animation delay (staggered 50ms per index for smoother cascade)
  const animationDelay = `${index * 50}ms`;

  // Format countdown display
  const countdownText = isOverdue
    ? `${Math.abs(deadline.daysUntil)}d ago`
    : `${deadline.daysUntil}d`;

  // Set mounted state for portal rendering
  useEffect(() => {
    setMounted(true);
  }, []);

  // Calculate optimal hover card position based on element position in viewport
  const calculatePosition = useCallback(() => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;

    // Hover card dimensions (approximate)
    const cardWidth = 224; // w-56 = 14rem = 224px
    const gap = 8; // ml-2 = 0.5rem = 8px

    // Determine horizontal position - prefer right side unless not enough space
    const spaceOnRight = viewportWidth - rect.right;
    const placement: "right" | "left" = spaceOnRight < cardWidth + gap ? "left" : "right";

    // Calculate absolute position with boundary checking
    let left: number;
    if (placement === "right") {
      left = rect.right + gap;
      // Ensure card doesn't overflow right edge
      if (left + cardWidth > viewportWidth - gap) {
        left = viewportWidth - cardWidth - gap;
      }
    } else {
      left = rect.left - cardWidth - gap;
      // Ensure card doesn't overflow left edge (prevent negative values)
      if (left < gap) {
        left = gap;
      }
    }

    setHoverPosition({
      top: rect.top,
      left,
      placement,
    });
  }, []);

  // Recalculate position when hover starts (only on devices with hover capability)
  const handleMouseEnter = useCallback(() => {
    if (!hasHover) return; // Skip hover card on touch devices
    calculatePosition();
    setShowHoverCard(true);
  }, [hasHover, calculatePosition]);

  const handleMouseLeave = useCallback(() => {
    setShowHoverCard(false);
  }, []);

  // Recalculate on scroll/resize while hovering
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!showHoverCard) return;

    const handleReposition = () => {
      // Throttle with requestAnimationFrame
      if (rafRef.current !== null) return;

      rafRef.current = requestAnimationFrame(() => {
        calculatePosition();
        rafRef.current = null;
      });
    };

    window.addEventListener("scroll", handleReposition, { capture: true, passive: true });
    window.addEventListener("resize", handleReposition, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleReposition, { capture: true } as EventListenerOptions);
      window.removeEventListener("resize", handleReposition);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [showHoverCard, calculatePosition]);

  // Render hover card via portal to escape overflow:hidden containers
  const renderHoverCard = () => {
    if (!showHoverCard || !hoverPosition || !mounted) return null;

    return createPortal(
      <div
        className={cn(
          "fixed w-56 bg-card border-2 border-black dark:border-white/20",
          "shadow-hard p-3 space-y-2 pointer-events-none",
          "animate-in fade-in-0 zoom-in-95 duration-150"
        )}
        style={{
          top: hoverPosition.top,
          left: hoverPosition.left,
          zIndex: Z_INDEX.tooltip,
        }}
      >
        <div>
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Case #
          </div>
          <div className="mono text-sm font-medium text-foreground">
            {deadline.caseNumber || "N/A"}
          </div>
        </div>
        <div>
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Beneficiary
          </div>
          <div className="text-sm font-medium text-foreground">
            {deadline.beneficiaryName}
          </div>
        </div>
        <div>
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Due
          </div>
          <div className="text-sm font-medium text-foreground">
            {deadline.dueDate}
          </div>
        </div>
      </div>,
      document.body
    );
  };

  return (
    <>
      <div
        ref={containerRef}
        className="animate-in slide-in-from-left-4 fill-mode-forwards ease-out"
        style={{ animationDelay, animationDuration: "0.3s" }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <a
          href={`/cases/${deadline.caseId}`}
          onClick={handleClick}
          className={cn(
            "group relative flex items-center justify-between",
            "px-4 py-3 bg-card border-2 border-black dark:border-white/20",
            "cursor-pointer transition-all duration-150 ease-out",
            "hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--foreground)]",
            isOverdue && "border-red-600 dark:border-red-500",
            isLoading && "pointer-events-none"
          )}
          style={{ opacity: isLoading ? 0.7 : 1 }}
        >
          {/* Loading spinner overlay */}
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          )}

          {/* Hazard stripes on LEFT edge for overdue items (v1 style) */}
          {isOverdue && (
            <div
              className="absolute top-0 left-0 w-1.5 h-full"
              style={{
                background: `repeating-linear-gradient(
                  0deg,
                  #dc2626,
                  #dc2626 4px,
                  #000 4px,
                  #000 8px
                )`,
              }}
            />
          )}

          {/* Left side: Employer + Type */}
          <div className={cn("flex-1 min-w-0", isOverdue && "pl-2")}>
            <div className="font-bold text-base truncate text-foreground">
              {deadline.employerName}
            </div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide">
              {deadline.label}
            </div>
          </div>

          {/* Right side: Countdown + Date */}
          <div className="text-right flex-shrink-0 ml-3">
            <div
              className={cn(
                "font-mono font-extrabold text-base",
                isOverdue ? "text-red-600 dark:text-red-500" : "text-foreground"
              )}
            >
              {countdownText}
            </div>
            <div className="text-xs text-muted-foreground">
              {deadline.dueDate}
            </div>
          </div>
        </a>
      </div>

      {/* Hover card rendered via portal */}
      {renderHoverCard()}
    </>
  );
}
