"use client";

/**
 * NavigableCard Component
 *
 * A clickable card wrapper that shows a loading state during navigation.
 * Uses React's useTransition for non-blocking UI updates.
 *
 * Features:
 * - Loading spinner overlay during navigation
 * - Disabled opacity while navigating
 * - Optional click handler for analytics/tracking
 * - Accessible focus states
 *
 * @example
 * ```tsx
 * <NavigableCard href="/cases/123" className="p-4">
 *   <h3>Case Title</h3>
 *   <p>Case details...</p>
 * </NavigableCard>
 * ```
 */

import { useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================================
// TYPES
// ============================================================================

export interface NavigableCardProps extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "onClick"> {
  /** Navigation target URL */
  href: string;
  /** Card content */
  children: ReactNode;
  /** Additional className */
  className?: string;
  /** Loading indicator style */
  loadingIndicator?: "spinner" | "overlay";
  /** Optional click handler (runs before navigation) */
  onClick?: () => void;
  /** Whether this is the active/selected item */
  isActive?: boolean;
  /** Disable navigation (just render as a div) */
  disabled?: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function NavigableCard({
  href,
  children,
  className,
  loadingIndicator = "spinner",
  onClick,
  isActive,
  disabled,
  ...restProps
}: NavigableCardProps) {
  const router = useRouter();
  const [isNavigating, startNavigation] = useTransition();

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();

    if (disabled) return;

    // Run optional click handler
    onClick?.();

    // Start navigation with transition
    startNavigation(() => {
      router.push(href);
    });
  };

  // Determine loading indicator element
  const loadingElement = isNavigating && (
    <>
      {loadingIndicator === "spinner" && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      )}
      {loadingIndicator === "overlay" && (
        <div className="absolute inset-0 bg-background/70 z-10" />
      )}
    </>
  );

  if (disabled) {
    return (
      <div
        className={cn(
          "relative cursor-not-allowed opacity-50",
          className
        )}
      >
        {children}
      </div>
    );
  }

  return (
    <a
      href={href}
      onClick={handleClick}
      className={cn(
        "relative block cursor-pointer transition-all duration-150",
        isNavigating && "pointer-events-none",
        isActive && "ring-2 ring-primary ring-offset-2",
        className
      )}
      style={{
        opacity: isNavigating ? 0.7 : 1,
      }}
      {...restProps}
    >
      {loadingElement}
      {children}
    </a>
  );
}

export default NavigableCard;
