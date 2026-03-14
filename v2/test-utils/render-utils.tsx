import { ReactElement, ReactNode } from "react";
import { render, RenderOptions } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/lib/contexts/AuthContext";

// Provider wrapper for component testing (next-themes mocked in vitest.setup.ts)
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

/** Render with all providers + userEvent instance */
export function renderWithProviders(
  ui: ReactElement,
  options?: RenderOptions & {
    providerProps?: { theme?: "light" | "dark" };
  }
) {
  const { providerProps, ...renderOptions } = options ?? {};
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <AllProviders {...providerProps}>{children}</AllProviders>
  );

  return {
    user: userEvent.setup(),
    ...render(ui, { ...renderOptions, wrapper: Wrapper }),
  };
}

/** Mock Next.js usePathname */
export function mockUsePathname(pathname: string) {
  return () => pathname;
}

/** Mock Next.js useRouter */
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

/** Mock Convex useQuery — returns data or undefined (loading) */
export function mockUseQuery<T>(data: T | undefined, isLoading = false) {
  return () => (isLoading ? undefined : data);
}

/** Mock Convex useMutation — returns the provided function */
export function mockUseMutation<T extends (...args: unknown[]) => unknown>(
  mutateFn: T
) {
  return () => mutateFn;
}

/** Wait for async state updates */
export async function waitForAsync(ms = 0) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
