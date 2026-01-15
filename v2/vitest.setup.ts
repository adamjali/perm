/**
 * Vitest Global Setup
 * Provides necessary mocks and polyfills for JSDOM environment.
 *
 * Phase: 20-02 (Dashboard Data Layer)
 * Created: 2025-12-23
 * Updated: 2025-12-24 (mock next-themes to avoid script injection)
 */

import { beforeAll, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import React from "react";

// ============================================================================
// TESTING LIBRARY MATCHERS
// ============================================================================

// jest-dom matchers are automatically extended when imported

// ============================================================================
// NEXT-THEMES MOCK
// ============================================================================

// Track the current theme for mocked useTheme hook
let mockTheme = "light";

/**
 * Mock next-themes to avoid script injection issues in tests.
 * The real next-themes ThemeProvider injects a <script> tag to prevent FOUC,
 * which interferes with container assertions in tests.
 */
/**
 * Mock next/navigation for components that use useRouter, useTransition.
 * The real next/navigation requires the Next.js App Router context which
 * doesn't exist in unit tests.
 */
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next-themes", () => ({
  ThemeProvider: ({ children, defaultTheme }: { children: React.ReactNode; defaultTheme?: string }) => {
    // Update mockTheme based on defaultTheme prop
    if (defaultTheme) {
      mockTheme = defaultTheme;
    }
    return React.createElement(React.Fragment, null, children);
  },
  useTheme: () => ({
    theme: mockTheme,
    setTheme: (newTheme: string) => {
      mockTheme = newTheme;
    },
    resolvedTheme: mockTheme,
    themes: ["light", "dark"],
    systemTheme: "light",
  }),
}));

// ============================================================================
// MOTION/REACT MOCK
// ============================================================================

/**
 * Mock motion/react (framer-motion) for tests.
 * Framer-motion uses browser APIs that don't exist in JSDOM.
 * We provide a simple mock that renders the children without animations.
 */
vi.mock("motion/react", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require("react");

  // Create a factory for motion components that pass through children
  // This simpler approach just creates a regular element with the appropriate tag
  const createMotionComponent = (tag: string) => {
    const MotionComponent = React.forwardRef(
      (props: Record<string, unknown>, ref: React.Ref<unknown>) => {
        // Extract motion-specific props that shouldn't be passed to DOM
        const {
          children,
          initial: _initial,
          animate: _animate,
          exit: _exit,
          transition: _transition,
          whileHover: _whileHover,
          whileTap: _whileTap,
          whileFocus: _whileFocus,
          whileDrag: _whileDrag,
          whileInView: _whileInView,
          layout: _layout,
          layoutId: _layoutId,
          variants: _variants,
          custom: _custom,
          inherit: _inherit,
          onAnimationStart: _onAnimationStart,
          onAnimationComplete: _onAnimationComplete,
          ...domProps
        } = props;

        // Pass all other props (including style, className, onClick, etc.) to the DOM element
        return React.createElement(tag, { ...domProps, ref }, children as React.ReactNode);
      }
    );
    MotionComponent.displayName = `motion.${tag}`;
    return MotionComponent;
  };

  // Proxy to create motion.div, motion.span, etc. on demand
  const motion = new Proxy(
    {},
    {
      get: (_target, prop: string) => {
        return createMotionComponent(prop);
      },
    }
  );

  return {
    motion,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => {
      // For AnimatePresence, just render children
      return React.createElement(React.Fragment, null, children);
    },
    useAnimation: () => ({
      start: vi.fn(),
      stop: vi.fn(),
      set: vi.fn(),
    }),
    useMotionValue: (initial: number) => ({
      get: () => initial,
      set: vi.fn(),
      onChange: vi.fn(),
    }),
    useTransform: () => ({
      get: () => 0,
      set: vi.fn(),
    }),
  };
});

// ============================================================================
// JSDOM POLYFILLS
// ============================================================================

beforeAll(() => {
  // Mock window.matchMedia for next-themes (dark mode support)
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(), // Deprecated
      removeListener: vi.fn(), // Deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  // Mock ResizeObserver for components that use it
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

  // Mock scrollIntoView for form validation scroll behavior
  Element.prototype.scrollIntoView = vi.fn();

  // Polyfill Blob.prototype.text for JSDOM
  // JSDOM doesn't fully support Blob.text() in all cases
  if (!Blob.prototype.text) {
    Blob.prototype.text = function (): Promise<string> {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsText(this);
      });
    };
  }
});
