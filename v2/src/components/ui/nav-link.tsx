"use client";

/**
 * NavLink Component
 * A navigation link with loading state indicator.
 *
 * Features:
 * - Shows loading spinner while navigating
 * - Lets Next.js handle navigation naturally (triggers loading.tsx immediately)
 * - Properly handles interrupted navigation (clicking another link clears other loading states)
 * - Scrolls to top after NavLink-initiated navigation completes (via NavLinkProvider)
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef, ComponentProps, createContext, useContext } from "react";
import { CircleNotch } from "@phosphor-icons/react";
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

  const targetHref = typeof href === "string" ? href : href.pathname || "";
  // Extract just the pathname portion (before any hash)
  const targetPath = targetHref.split("#")[0] || "/";
  const isCurrentPage = pathname === targetPath;
  const isHashOnly = targetHref.includes("#") && isCurrentPage;

  const isNavigating = context?.activeNavigation === targetHref;

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Call original onClick if provided
    onClick?.(e);

    if (e.defaultPrevented) return;

    // Hash link into the page we are already on. The browser's native anchor
    // scroll is exactly right here, so get out of its way.
    if (isHashOnly) return;

    // Link to the page we are already on.
    //
    // This branch exists because without it the click did literally nothing.
    // Next.js treats a <Link> to the current route as a no-op, and the scroll
    // reset in NavLinkProvider only fires when the pathname CHANGES, so a
    // same-page link produced no navigation, no scroll, and no feedback of any
    // kind. Reported from a phone as "the Blog link is broken": the reporter
    // was on /blog, 4390px down at the footer, and tapping Blog did nothing
    // while every other link worked. On desktop you can see which page you are
    // on; after a long scroll on a phone, no response reads as a dead link.
    //
    // Scrolling to the top is both the honest answer to "take me to Blog" when
    // you are already on Blog, and the same thing every other link does on
    // arrival, so the footer now behaves consistently whichever one you tap.
    // "instant" matches NavLinkProvider rather than introducing a second
    // scrolling style, and it sidesteps a multi-thousand-pixel smooth scroll.
    if (isCurrentPage) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: "instant" });
      return;
    }

    // Set this link as actively navigating (clears other NavLinks)
    // Always coordinate via context so other components can detect navigation,
    // even when this NavLink doesn’t show its own spinner (showLoading=false)
    if (context) {
      context.setActiveNavigation(targetHref || "/");
    }
    // Let the Link handle navigation naturally - this triggers loading.tsx immediately
  };

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
      // Marks the link pointing at the page you are already on. It was absent
      // entirely, so a screen reader announced the current page's own link
      // identically to every other one, and nothing in the markup distinguished
      // them. Hash links are excluded: /#features while on / points at a
      // section, not at the page itself.
      aria-current={isCurrentPage && !isHashOnly ? "page" : undefined}
      {...props}
    >
      {isNavigating && showLoading ? (
        <span className="inline-flex items-center gap-2">
          <CircleNotch
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
