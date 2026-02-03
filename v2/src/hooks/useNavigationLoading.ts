"use client";

import { useCallback, useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useNavigationContext } from "@/components/ui/nav-link";

const BACK_SENTINEL = "__nav_back__";

/**
 * useNavigationLoading Hook
 *
 * Provides navigation with a loading state that coordinates with ALL other
 * navigation components (NavLink, NavigableCard, etc.) via shared context.
 * When any component starts navigating, all other loading indicators clear.
 *
 * @returns Object with:
 *   - isNavigating: boolean - true if THIS instance initiated the active navigation
 *   - isAnyNavigating: boolean - true if ANY navigation is in progress
 *   - targetPath: string | null - the path being navigated to (null if back or not navigating)
 *   - navigateTo: function to navigate to a path with loading state
 *   - navigateBack: function to go back with loading state
 *   - refresh: function to refresh the current page
 */
export function useNavigationLoading() {
  const router = useRouter();
  const pathname = usePathname();
  const context = useNavigationContext();
  const [myTarget, setMyTarget] = useState<string | null>(null);
  const previousPathnameRef = useRef(pathname);

  // This instance is navigating if our target matches the shared active navigation
  const isNavigating = context
    ? context.activeNavigation !== null && context.activeNavigation === myTarget
    : false;

  // Any navigation is in progress (useful for disabling buttons globally)
  const isAnyNavigating = context
    ? context.activeNavigation !== null
    : false;

  const navigateTo = useCallback(
    (path: string) => {
      setMyTarget(path);
      context?.setActiveNavigation(path);
      router.push(path);
    },
    [router, context]
  );

  // Reset local target when pathname changes
  useEffect(() => {
    if (pathname !== previousPathnameRef.current) {
      setMyTarget(null);
      previousPathnameRef.current = pathname;
    }
  }, [pathname]);

  const navigateBack = useCallback(() => {
    setMyTarget(BACK_SENTINEL);
    context?.setActiveNavigation(BACK_SENTINEL);
    router.back();
  }, [router, context]);

  const refresh = useCallback(() => {
    setMyTarget(null);
    router.refresh();
  }, [router]);

  return {
    isNavigating,
    isAnyNavigating,
    targetPath: isNavigating && myTarget !== BACK_SENTINEL ? myTarget : null,
    navigateTo,
    navigateBack,
    refresh,
  };
}
