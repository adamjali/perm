"use client";

/**
 * NavLink Component
 * A navigation link with loading state indicator.
 *
 * Features:
 * - Shows loading spinner while navigating
 * - Lets Next.js handle navigation naturally (triggers loading.tsx immediately)
 * - Properly handles interrupted navigation (clicking another link clears other loading states)
 * - Scrolls to top after navigation completes
 *
 * Phase: 20-02 (Dashboard Data Layer)
 * Updated: 2026-01-02
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef, ComponentProps, createContext, useContext } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Context to coordinate loading states across NavLinks
// When one NavLink starts navigating, it broadcasts to clear others
const NavLinkContext = createContext<{
  activeNavigation: string | null;
  setActiveNavigation: (path: string | null) => void;
} | null>(null);

/**
 * Hook for any component to access the shared navigation loading context.
 * Returns null if not inside NavLinkProvider.
 */
export function useNavigationContext() {
  return useContext(NavLinkContext);
}

// Provider component to wrap app and coordinate NavLink loading states
export function NavLinkProvider({ children }: { children: React.ReactNode }) {
  const [activeNavigation, setActiveNavigation] = useState<string | null>(null);
  const pathname = usePathname();
  const previousPathnameRef = useRef(pathname);

  // Clear active navigation and scroll to top when pathname changes
  useEffect(() => {
    if (pathname !== previousPathnameRef.current) {
      if (activeNavigation) {
        setActiveNavigation(null);
        window.scrollTo({ top: 0, behavior: "instant" });
      }
      previousPathnameRef.current = pathname;
    }
  }, [pathname, activeNavigation]);

  return (
    <NavLinkContext.Provider value={{ activeNavigation, setActiveNavigation }}>
      {children}
    </NavLinkContext.Provider>
  );
}

type NavLinkProps = ComponentProps<typeof Link> & {
  /** Show loading spinner during navigation */
  showLoading?: boolean;
  /** Additional class for the loading spinner */
  spinnerClassName?: string;
  /** Loading spinner size (matches Lucide icon sizing) */
  spinnerSize?: number;
};

export function NavLink({
  href,
  children,
  className,
  showLoading = true,
  spinnerClassName,
  spinnerSize = 16,
  onClick,
  ...props
}: NavLinkProps) {
  const pathname = usePathname();
  const context = useContext(NavLinkContext);
  const [localIsNavigating, setLocalIsNavigating] = useState(false);
  const previousPathnameRef = useRef(pathname);

  const targetPath = typeof href === "string" ? href : href.pathname;
  const isCurrentPage = pathname === targetPath;

  // Use context if available, otherwise fall back to local state
  const isNavigating = context
    ? context.activeNavigation === targetPath
    : localIsNavigating;

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Call original onClick if provided
    onClick?.(e);

    // If default was prevented or it's the current page, don't show loading
    if (e.defaultPrevented || isCurrentPage) return;

    // Set this link as actively navigating (clears other NavLinks)
    // Always coordinate via context so other components can detect navigation,
    // even when this NavLink doesn't show its own spinner (showLoading=false)
    if (context) {
      context.setActiveNavigation(targetPath || "/");
    } else if (showLoading) {
      setLocalIsNavigating(true);
    }
    // Let the Link handle navigation naturally - this triggers loading.tsx immediately
  };

  // Fallback: Reset local state when pathname changes (for NavLinks outside provider)
  useEffect(() => {
    if (!context && pathname !== previousPathnameRef.current) {
      if (localIsNavigating) {
        setLocalIsNavigating(false);
        window.scrollTo({ top: 0, behavior: "instant" });
      }
      previousPathnameRef.current = pathname;
    }
  }, [pathname, localIsNavigating, context]);

  return (
    <Link
      href={href}
      className={cn(
        className,
        isNavigating && "pointer-events-none",
        isNavigating && showLoading && "opacity-70"
      )}
      onClick={handleClick}
      aria-disabled={isNavigating}
      {...props}
    >
      {isNavigating && showLoading ? (
        <span className="inline-flex items-center gap-2">
          <Loader2
            size={spinnerSize}
            className={cn("animate-spin", spinnerClassName)}
          />
          {children}
        </span>
      ) : (
        children
      )}
    </Link>
  );
}

export default NavLink;
