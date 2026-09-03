"use client";

/**
 * NavLink Component
 * A navigation link with loading state indicator.
 *
 * Features:
 * - Shows a loading spinner while navigating, from Next's own `useLinkStatus`
 * - Lets Next.js handle navigation naturally (triggers loading.tsx immediately)
 * - Broadcasts through NavLinkProvider so other components can see a navigation
 * - Scrolls to top after NavLink-initiated navigation completes (via NavLinkProvider)
 *
 * THE SPINNER USED TO BE DRIVEN BY THE SHARED CONTEXT AND THAT WAS THE BUG.
 * `activeNavigation` is set on click and cleared on a pathname CHANGE, so a
 * click that never arrived somewhere left this link spinning, at `opacity-70`,
 * with `pointer-events-none` and `aria-disabled` on it - permanently dead, and
 * dead in exactly the way the reader was complaining about. `useLinkStatus`
 * resolves on commit, failure and supersede alike, so it cannot strand
 * anything, and nothing is disabled any more: a second click on a slow link is
 * harmless, a link you cannot click is not.
 */

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef, ComponentProps, createContext, useContext } from "react";
import { CircleNotchIcon } from "@phosphor-icons/react";
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

  // A NAVIGATION THAT NEVER ARRIVES MUST NOT LEAVE THE SITE LOOKING BUSY
  // FOREVER. The clear above is the only one there was, and it fires on a
  // pathname CHANGE - so a click that goes nowhere (the server errored, the
  // reader hit Back, the link pointed at a route that failed to load) left
  // `activeNavigation` set for the life of the page. Everything reading
  // `isAnyNavigating` then believed a navigation was still running.
  //
  // Ten seconds, not two: this is a backstop for a navigation that will never
  // resolve, not a timeout on a slow one. A cold entity page on a busy Turso
  // primary has been measured at several seconds, and cancelling the signal
  // out from under a request that is still working is its own bug.
  useEffect(() => {
    if (!activeNavigation) return;
    const t = setTimeout(() => setActiveNavigation(null), 10_000);
    return () => clearTimeout(t);
  }, [activeNavigation]);

  return (
    <NavLinkContext.Provider value={{ activeNavigation, setActiveNavigation }}>
      {children}
    </NavLinkContext.Provider>
  );
}

/**
 * The pending marker, and why it is a separate component.
 *
 * `useLinkStatus` has to be read INSIDE the `<Link>` subtree - Next provides
 * it through a context the Link itself renders - so the signal cannot be read
 * where the anchor's own className is written.
 *
 * IT IS THE AUTHORITATIVE SIGNAL AND THE CONTEXT IS NOT. Next drives it from
 * `useOptimistic` inside the navigation transition (read in
 * `next/dist/client/app-dir/link.js`, not assumed), so it goes false when the
 * navigation commits, fails, or is superseded by another click. The shared
 * `activeNavigation` context can only clear on a pathname change, which is why
 * it used to strand a link that went nowhere.
 *
 * IT NEVER MOVES THE LAYOUT AND IT NEVER PULSES. The icon is always mounted at
 * zero width and reveals after 150ms of pending, so a warm or prefetched
 * navigation - which resolves in a frame - never flashes it, and the label
 * does not jump when a slow one does. A rotation, not a pulse: this project
 * bans breathing animations, and `motion-reduce` drops the rotation entirely.
 */
function NavLinkSpinner({
  size,
  className,
}: {
  size: number;
  className?: string;
}) {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden="true"
      data-pending={pending || undefined}
      className={cn(
        "inline-flex w-0 shrink-0 items-center overflow-hidden opacity-0",
        "transition-[width,margin,opacity] duration-150 ease-out",
        "data-[pending]:mr-2 data-[pending]:w-(--nav-spinner) data-[pending]:opacity-100",
        "data-[pending]:[transition-delay:150ms]",
        "motion-reduce:transition-none",
      )}
      style={{ ["--nav-spinner" as string]: `${size}px` }}
    >
      <CircleNotchIcon
        size={size}
        className={cn("animate-spin motion-reduce:animate-none", className)}
      />
    </span>
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
      className={className}
      onClick={handleClick}
      // Marks the link pointing at the page you are already on. It was absent
      // entirely, so a screen reader announced the current page's own link
      // identically to every other one, and nothing in the markup distinguished
      // them. Hash links are excluded: /#features while on / points at a
      // section, not at the page itself.
      aria-current={isCurrentPage && !isHashOnly ? "page" : undefined}
      {...props}
    >
      {showLoading ? (
        // NOT `{isNavigating && <spinner/>}`. The marker has to be mounted
        // before it can read `useLinkStatus`, and mounting it only once
        // something else already believes a navigation started is how the
        // context became the signal in the first place.
        <span className="inline-flex items-center">
          <NavLinkSpinner size={spinnerSize} className={spinnerClassName} />
          {children}
        </span>
      ) : (
        children
      )}
    </Link>
  );
}

export default NavLink;
