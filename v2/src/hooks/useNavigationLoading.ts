"use client";

import { useCallback, useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";

/**
 * useNavigationLoading Hook
 *
 * Provides a way to navigate with a loading state indicator.
 * Navigation happens immediately without blocking.
 * Scrolls to top AFTER navigation completes, not before.
 * Clicking a new navigation target clears other loading states.
 *
 * @returns Object with:
 *   - isNavigating: boolean indicating if navigation is in progress
 *   - targetPath: string | null - the path being navigated to (null if not navigating or going back)
 *   - navigateTo: function to navigate to a path with loading state
 *   - navigateBack: function to go back with loading state
 *
 * @example
 * ```tsx
 * function BackButton() {
 *   const { isNavigating, navigateTo, targetPath } = useNavigationLoading();
 *
 *   return (
 *     <Button
 *       onClick={() => navigateTo("/cases")}
 *       disabled={isNavigating}
 *     >
 *       {isNavigating && targetPath === "/cases" ? <Loader2 className="animate-spin" /> : <ArrowLeft />}
 *       Back
 *     </Button>
 *   );
 * }
 * ```
 */
export function useNavigationLoading() {
  const router = useRouter();
  const pathname = usePathname();
  const [targetPath, setTargetPath] = useState<string | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const previousPathnameRef = useRef(pathname);

  /**
   * Navigate to a specific path with loading state
   * Navigation happens immediately - no blocking with startTransition
   * Scrolls to top after navigation completes (handled by useEffect)
   */
  const navigateTo = useCallback(
    (path: string) => {
      setTargetPath(path);
      setIsNavigating(true);
      // Navigate immediately without startTransition blocking
      router.push(path);
    },
    [router]
  );

  // Scroll to top AFTER navigation completes and reset loading state
  useEffect(() => {
    if (pathname !== previousPathnameRef.current) {
      if (isNavigating) {
        setIsNavigating(false);
        setTargetPath(null);
        window.scrollTo({ top: 0, behavior: "instant" });
      }
      previousPathnameRef.current = pathname;
    }
  }, [pathname, isNavigating]);

  /**
   * Navigate back with loading state
   */
  const navigateBack = useCallback(() => {
    setTargetPath(null);
    setIsNavigating(true);
    router.back();
  }, [router]);

  /**
   * Refresh the current page with loading state
   */
  const refresh = useCallback(() => {
    setTargetPath(null);
    router.refresh();
  }, [router]);

  return {
    isNavigating,
    targetPath: isNavigating ? targetPath : null,
    navigateTo,
    navigateBack,
    refresh,
  };
}
