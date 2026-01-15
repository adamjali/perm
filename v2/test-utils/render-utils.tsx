/**
 * React Testing Utilities
 * Render helpers for component testing with providers.
 *
 * Provides:
 * - AllProviders - Wrapper component with all necessary providers
 * - renderWithProviders() - Render helper with providers
 * - Mock hooks for Next.js router
 *
 * Note: next-themes is globally mocked in vitest.setup.ts to prevent
 * script injection issues. The ThemeProvider here uses the mock.
 */

import { ReactElement, ReactNode } from "react";
import { render, RenderOptions } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/lib/contexts/AuthContext";

// ============================================================================
// PROVIDER WRAPPER
// ============================================================================

/**
 * All providers needed for component testing.
 * Wraps components with ThemeProvider for light/dark mode support.
 *
 * Note: next-themes is globally mocked in vitest.setup.ts to avoid
 * script injection that interferes with container.firstChild assertions.
 *
 * @example
 * <AllProviders>
 *   <YourComponent />
 * </AllProviders>
 */
export function AllProviders({
  children,
  theme = "light",
}: {
  children: ReactNode;
  theme?: "light" | "dark";
}) {
  return (
    <AuthProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme={theme}
        enableSystem={false}
        disableTransitionOnChange
      >
        {children}
      </ThemeProvider>
    </AuthProvider>
  );
}

// ============================================================================
// RENDER HELPERS
// ============================================================================

/**
 * Custom render function that wraps components with all providers.
 * Use this instead of @testing-library/react's render() in component tests.
 *
 * @example
 * // Basic usage
 * const { getByText } = renderWithProviders(<MyComponent />);
 *
 * // With theme override
 * const { container } = renderWithProviders(<MyComponent />, {
 *   providerProps: { theme: "dark" }
 * });
 *
 * // With user events
 * const { user, getByRole } = renderWithProviders(<MyComponent />);
 * await user.click(getByRole("button"));
 */
export function renderWithProviders(
  ui: ReactElement,
  options?: RenderOptions & {
    providerProps?: { theme?: "light" | "dark" };
  }
) {
  const { providerProps, ...renderOptions } = options ?? {};

  // Wrapper component that combines AllProviders
  const Wrapper = ({ children }: { children: ReactNode }) => {
    return <AllProviders {...providerProps}>{children}</AllProviders>;
  };

  return {
    user: userEvent.setup(),
    ...render(ui, { ...renderOptions, wrapper: Wrapper }),
  };
}

// ============================================================================
// MOCK HOOKS (Next.js Router)
// ============================================================================

/**
 * Mock Next.js usePathname hook for testing.
 * Use with vi.mock() to control pathname in tests.
 *
 * @example
 * import { vi } from "vitest";
 * import { mockUsePathname } from "@/test-utils/render-utils";
 *
 * // Mock the hook
 * vi.mock("next/navigation", () => ({
 *   usePathname: mockUsePathname("/dashboard")
 * }));
 *
 * // In test
 * const { getByText } = renderWithProviders(<Nav />);
 * expect(getByText("Dashboard")).toHaveClass("active");
 */
export function mockUsePathname(pathname: string) {
  return () => pathname;
}

/**
 * Mock Next.js useRouter hook for testing.
 * Use with vi.mock() to control router behavior in tests.
 *
 * @example
 * import { vi } from "vitest";
 * import { mockUseRouter } from "@/test-utils/render-utils";
 *
 * const pushMock = vi.fn();
 * vi.mock("next/navigation", () => ({
 *   useRouter: mockUseRouter({ push: pushMock })
 * }));
 *
 * // In test
 * const { getByRole } = renderWithProviders(<NavButton />);
 * fireEvent.click(getByRole("button"));
 * expect(pushMock).toHaveBeenCalledWith("/dashboard");
 */
export function mockUseRouter(
  overrides: Partial<{
    push: (url: string) => void;
    replace: (url: string) => void;
    back: () => void;
    forward: () => void;
    refresh: () => void;
    prefetch: (url: string) => void;
  }> = {}
) {
  return () => ({
    push: overrides.push ?? (() => {}),
    replace: overrides.replace ?? (() => {}),
    back: overrides.back ?? (() => {}),
    forward: overrides.forward ?? (() => {}),
    refresh: overrides.refresh ?? (() => {}),
    prefetch: overrides.prefetch ?? (() => {}),
  });
}

/**
 * Mock Convex useQuery hook for testing.
 * Use with vi.mock() to provide test data without backend.
 *
 * @example
 * import { vi } from "vitest";
 * import { mockUseQuery } from "@/test-utils/render-utils";
 * import { createMockDashboardSummary } from "@/test-utils/ui-fixtures";
 *
 * const mockData = createMockDashboardSummary();
 * vi.mock("convex/react", () => ({
 *   useQuery: mockUseQuery(mockData)
 * }));
 *
 * // In test
 * const { getByText } = renderWithProviders(<Dashboard />);
 * expect(getByText("5")).toBeInTheDocument(); // PWD count
 */
export function mockUseQuery<T>(data: T | undefined, isLoading = false) {
  return () => (isLoading ? undefined : data);
}

/**
 * Mock Convex useMutation hook for testing.
 * Use with vi.mock() to track mutation calls.
 *
 * @example
 * import { vi } from "vitest";
 * import { mockUseMutation } from "@/test-utils/render-utils";
 *
 * const mutateMock = vi.fn();
 * vi.mock("convex/react", () => ({
 *   useMutation: mockUseMutation(mutateMock)
 * }));
 *
 * // In test
 * const { getByRole } = renderWithProviders(<CreateCaseButton />);
 * fireEvent.click(getByRole("button"));
 * expect(mutateMock).toHaveBeenCalledWith({ ... });
 */
export function mockUseMutation<T extends (...args: unknown[]) => unknown>(
  mutateFn: T
) {
  return () => mutateFn;
}

// ============================================================================
// TEST UTILITIES
// ============================================================================

/**
 * Wait for async state updates in tests.
 * Use after actions that trigger async state changes.
 *
 * @example
 * import { waitForAsync } from "@/test-utils/render-utils";
 *
 * fireEvent.click(getByRole("button"));
 * await waitForAsync();
 * expect(getByText("Success")).toBeInTheDocument();
 */
export async function waitForAsync(ms = 0) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Helper to test loading states.
 * Renders component with useQuery returning undefined (loading state).
 *
 * @example
 * const { container } = renderLoadingState(<Dashboard />);
 * expect(container.querySelector(".skeleton")).toBeInTheDocument();
 */
export function renderLoadingState(ui: ReactElement) {
  // Mock useQuery to return undefined (loading)
  return renderWithProviders(ui);
}

/**
 * Helper to suppress console errors during tests.
 * Useful when testing error boundaries or expected errors.
 *
 * @example
 * suppressConsoleError(() => {
 *   // Test code that throws expected errors
 *   expect(() => throwError()).toThrow();
 * });
 */
export function suppressConsoleError(callback: () => void) {
  const originalError = console.error;
  console.error = () => {};
  try {
    callback();
  } finally {
    console.error = originalError;
  }
}
