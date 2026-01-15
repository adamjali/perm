/**
 * PWA Install Prompt Hook and Component
 *
 * Captures the `beforeinstallprompt` event and provides a hook for
 * triggering the install prompt from anywhere in the app.
 *
 * Features:
 * - Captures beforeinstallprompt event
 * - Provides useInstallPrompt hook for settings page
 * - Detects if app is already installed (standalone mode)
 * - Non-intrusive - doesn't auto-show banners
 *
 * Phase: 31 (PWA)
 * Created: 2025-01-11
 */

"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";

// ============================================================================
// TYPES
// ============================================================================

/**
 * BeforeInstallPromptEvent - browser event for PWA install prompt
 * This is a non-standard event only available in Chromium browsers
 */
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

/**
 * Extended Navigator interface for iOS Safari's non-standard standalone property
 * iOS Safari sets this to true when the app is launched from the home screen
 */
interface NavigatorStandalone extends Navigator {
  standalone?: boolean;
}

interface InstallPromptContextValue {
  /** Whether the browser supports the install prompt */
  isSupported: boolean;
  /** Whether the app is already installed (standalone mode) */
  isInstalled: boolean;
  /** Whether the install prompt can be shown */
  canPrompt: boolean;
  /** Trigger the install prompt */
  promptInstall: () => Promise<boolean>;
}

// ============================================================================
// CONTEXT
// ============================================================================

const InstallPromptContext = createContext<InstallPromptContextValue>({
  isSupported: false,
  isInstalled: false,
  canPrompt: false,
  promptInstall: async () => false,
});

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Check if app is running in standalone mode (installed PWA)
 */
function isStandaloneMode(): boolean {
  if (typeof window === "undefined") return false;

  // Check display-mode media query
  if (window.matchMedia("(display-mode: standalone)").matches) {
    return true;
  }

  // iOS Safari adds this property when launched from home screen
  if ((navigator as NavigatorStandalone).standalone === true) {
    return true;
  }

  return false;
}

// ============================================================================
// PROVIDER COMPONENT
// ============================================================================

interface InstallPromptProviderProps {
  children: ReactNode;
}

/**
 * InstallPromptProvider
 *
 * Wraps the app to capture the beforeinstallprompt event and provide
 * install prompt functionality throughout the component tree.
 *
 * @example
 * ```tsx
 * // In layout.tsx
 * import { InstallPromptProvider } from '@/components/pwa';
 *
 * export default function Layout({ children }) {
 *   return (
 *     <InstallPromptProvider>
 *       {children}
 *     </InstallPromptProvider>
 *   );
 * }
 * ```
 */
export function InstallPromptProvider({
  children,
}: InstallPromptProviderProps): ReactNode {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  // Check if already installed
  useEffect(() => {
    setIsInstalled(isStandaloneMode());

    // Listen for app install (successful prompt)
    const handleAppInstalled = () => {
      console.log("[PWA] App was installed");
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("appinstalled", handleAppInstalled);
    return () => window.removeEventListener("appinstalled", handleAppInstalled);
  }, []);

  // Capture beforeinstallprompt event
  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      // Prevent Chrome's default install banner
      event.preventDefault();
      // Save the event for later use
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      console.log("[PWA] Install prompt captured");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () =>
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
  }, []);

  // Trigger install prompt
  const promptInstall = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) {
      console.log("[PWA] No install prompt available");
      return false;
    }

    // Show the install prompt
    await deferredPrompt.prompt();

    // Wait for user choice
    const { outcome } = await deferredPrompt.userChoice;
    console.log("[PWA] User choice:", outcome);

    // Clear the prompt (can only be used once)
    setDeferredPrompt(null);

    return outcome === "accepted";
  }, [deferredPrompt]);

  const value: InstallPromptContextValue = {
    isSupported: typeof window !== "undefined" && "BeforeInstallPromptEvent" in window,
    isInstalled,
    canPrompt: deferredPrompt !== null && !isInstalled,
    promptInstall,
  };

  return (
    <InstallPromptContext.Provider value={value}>
      {children}
    </InstallPromptContext.Provider>
  );
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * useInstallPrompt Hook
 *
 * Access PWA install prompt functionality.
 *
 * @returns Object with install prompt state and methods
 *
 * @example
 * ```tsx
 * // In settings page
 * import { useInstallPrompt } from '@/components/pwa';
 *
 * function InstallButton() {
 *   const { canPrompt, isInstalled, promptInstall } = useInstallPrompt();
 *
 *   if (isInstalled) {
 *     return <span>App is installed</span>;
 *   }
 *
 *   if (!canPrompt) {
 *     return null; // No prompt available
 *   }
 *
 *   return (
 *     <button onClick={promptInstall}>
 *       Install App
 *     </button>
 *   );
 * }
 * ```
 */
export function useInstallPrompt(): InstallPromptContextValue {
  return useContext(InstallPromptContext);
}

export default InstallPromptProvider;
