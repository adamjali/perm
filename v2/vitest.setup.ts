import { beforeAll, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import React from "react";

let mockTheme = "light";

// Mock next/navigation's HOOKS (they require App Router context unavailable
// in tests) while keeping the real module for everything else. notFound() and
// redirect() are plain throwers with meaningful digests, and replacing the
// whole module used to erase them - which made any test of a miss path fail
// with "No notFound export" instead of exercising the real signal.
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<object>()),
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

// Mock next-themes (real one injects <script> that breaks container assertions)
vi.mock("next-themes", () => ({
  ThemeProvider: ({ children, defaultTheme }: { children: React.ReactNode; defaultTheme?: string }) => {
    if (defaultTheme) mockTheme = defaultTheme;
    return React.createElement(React.Fragment, null, children);
  },
  useTheme: () => ({
    theme: mockTheme,
    setTheme: (newTheme: string) => { mockTheme = newTheme; },
    resolvedTheme: mockTheme,
    themes: ["light", "dark"],
    systemTheme: "light",
  }),
}));

vi.mock("posthog-js", () => ({
  default: {
    init: vi.fn(),
    capture: vi.fn(),
    identify: vi.fn(),
    reset: vi.fn(),
    opt_out_capturing: vi.fn(),
    opt_in_capturing: vi.fn(),
    isFeatureEnabled: vi.fn(),
    getFeatureFlag: vi.fn(),
  },
}));

// Mock motion/react — renders elements without animations
vi.mock("motion/react", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require("react");

  const createMotionComponent = (tag: string) => {
    const MotionComponent = React.forwardRef(
      (props: Record<string, unknown>, ref: React.Ref<unknown>) => {
        const {
          children,
          initial: _initial, animate: _animate, exit: _exit,
          transition: _transition, whileHover: _whileHover, whileTap: _whileTap,
          whileFocus: _whileFocus, whileDrag: _whileDrag, whileInView: _whileInView,
          layout: _layout, layoutId: _layoutId, variants: _variants,
          custom: _custom, inherit: _inherit,
          onAnimationStart: _onAnimationStart, onAnimationComplete: _onAnimationComplete,
          ...domProps
        } = props;
        return React.createElement(tag, { ...domProps, ref }, children as React.ReactNode);
      }
    );
    MotionComponent.displayName = `motion.${tag}`;
    return MotionComponent;
  };

  const motion = new Proxy({}, {
    get: (_target, prop: string) => createMotionComponent(prop),
  });

  return {
    motion,
    AnimatePresence: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    useAnimation: () => ({ start: vi.fn(), stop: vi.fn(), set: vi.fn() }),
    // Added 2026-08-31. Its absence made any test that RENDERS a component
    // wrapped in ScrollReveal throw `No "useInView" export is defined on the
    // "motion/react" mock` - which reads like a broken component and is a
    // gap in this mock. `true` so revealed content is present in the tree;
    // a reveal that never fires would hide the very markup under test.
    useInView: () => true,
    // Same gap, same day. The real hook reads a media query; false keeps the
    // animated branch live, which is the one worth exercising.
    useReducedMotion: () => false,
    useMotionValue: (initial: number) => ({ get: () => initial, set: vi.fn(), onChange: vi.fn() }),
    useTransform: () => ({ get: () => 0, set: vi.fn() }),
  };
});

// JSDOM polyfills
beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false, media: query, onchange: null,
      addListener: vi.fn(), removeListener: vi.fn(),
      addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
    })),
  });

  global.ResizeObserver = class ResizeObserver {
    observe() {} unobserve() {} disconnect() {}
  };

  Element.prototype.scrollIntoView = vi.fn();

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
