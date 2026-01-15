/**
 * RouteError Component Tests
 *
 * Tests the error boundary UI component used in Next.js App Router error.tsx files.
 * Verifies Sentry integration, button callbacks, and dev/prod message differences.
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as Sentry from "@sentry/nextjs";
import { RouteError } from "../RouteError";

// Mock Sentry
vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  AlertTriangle: () => <div data-testid="alert-triangle-icon" />,
  RefreshCcw: () => <div data-testid="refresh-icon" />,
  Home: () => <div data-testid="home-icon" />,
}));

describe("RouteError", () => {
  const mockReset = vi.fn();
  const mockError = new Error("Test error message");
  const mockErrorWithDigest = Object.assign(new Error("Digest error"), {
    digest: "abc123",
  });

  // Store original NODE_ENV and window.location
  const originalNodeEnv = process.env.NODE_ENV;
  let originalLocation: Location;

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock console.error to prevent noise in test output
    vi.spyOn(console, "error").mockImplementation(() => {});

    // Save and mock window.location
    originalLocation = window.location;
    Object.defineProperty(window, "location", {
      writable: true,
      value: { href: "", pathname: "/test" },
    });
  });

  afterEach(() => {
    // Restore NODE_ENV
    process.env.NODE_ENV = originalNodeEnv;
    // Restore window.location
    Object.defineProperty(window, "location", {
      writable: true,
      value: originalLocation,
    });
  });

  describe("Sentry Integration", () => {
    it("calls Sentry.captureException with error and route context on mount", () => {
      render(<RouteError error={mockError} reset={mockReset} />);

      expect(Sentry.captureException).toHaveBeenCalledTimes(1);
      expect(Sentry.captureException).toHaveBeenCalledWith(mockError, {
        tags: {
          component: "RouteError",
          route: expect.any(String),
        },
        extra: {
          url: expect.any(String),
          referrer: expect.any(String),
        },
      });
    });

    it("includes digest in Sentry tags when error has digest", () => {
      render(<RouteError error={mockErrorWithDigest} reset={mockReset} />);

      expect(Sentry.captureException).toHaveBeenCalledWith(
        mockErrorWithDigest,
        {
          tags: {
            component: "RouteError",
            route: expect.any(String),
            digest: "abc123",
          },
          extra: {
            url: expect.any(String),
            referrer: expect.any(String),
          },
        }
      );
    });

    it("logs error to console", () => {
      render(<RouteError error={mockError} reset={mockReset} />);

      expect(console.error).toHaveBeenCalledWith("[RouteError]", mockError);
    });
  });

  describe("Development Mode Display", () => {
    beforeEach(() => {
      process.env.NODE_ENV = "development";
    });

    it("displays error message in development mode", () => {
      render(<RouteError error={mockError} reset={mockReset} />);

      expect(screen.getByText("Test error message")).toBeInTheDocument();
    });

    it("displays error digest in development mode", () => {
      render(<RouteError error={mockErrorWithDigest} reset={mockReset} />);

      expect(screen.getByText(/Digest: abc123/)).toBeInTheDocument();
    });
  });

  describe("Production Mode Display", () => {
    beforeEach(() => {
      process.env.NODE_ENV = "production";
    });

    it("displays generic message in production mode", () => {
      render(<RouteError error={mockError} reset={mockReset} />);

      expect(
        screen.getByText("An unexpected error occurred. Please try again.")
      ).toBeInTheDocument();
      expect(screen.queryByText("Test error message")).not.toBeInTheDocument();
    });

    it("does not display error digest in production mode", () => {
      render(<RouteError error={mockErrorWithDigest} reset={mockReset} />);

      expect(screen.queryByText(/Digest:/)).not.toBeInTheDocument();
    });
  });

  describe("Button Interactions", () => {
    it("calls reset function when Try Again button is clicked", { timeout: 15000 }, () => {
      render(<RouteError error={mockError} reset={mockReset} />);

      const tryAgainButton = screen.getByRole("button", { name: /try again/i });
      fireEvent.click(tryAgainButton);

      expect(mockReset).toHaveBeenCalledTimes(1);
    });

    it("navigates to dashboard when Go to Dashboard button is clicked", () => {
      render(<RouteError error={mockError} reset={mockReset} />);

      const dashboardButton = screen.getByRole("button", {
        name: /go to dashboard/i,
      });
      fireEvent.click(dashboardButton);

      expect(window.location.href).toBe("/dashboard");
    });

    it("navigates to custom homeHref when provided", () => {
      render(
        <RouteError error={mockError} reset={mockReset} homeHref="/cases" />
      );

      const dashboardButton = screen.getByRole("button", {
        name: /go to dashboard/i,
      });
      fireEvent.click(dashboardButton);

      expect(window.location.href).toBe("/cases");
    });
  });

  describe("Custom Props", () => {
    it("displays custom title when provided", () => {
      render(
        <RouteError
          error={mockError}
          reset={mockReset}
          title="Custom Error Title"
        />
      );

      expect(screen.getByText("Custom Error Title")).toBeInTheDocument();
    });

    it("displays default title when not provided", () => {
      render(<RouteError error={mockError} reset={mockReset} />);

      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    });
  });

  describe("UI Elements", () => {
    it("renders alert triangle icon", () => {
      render(<RouteError error={mockError} reset={mockReset} />);

      expect(screen.getByTestId("alert-triangle-icon")).toBeInTheDocument();
    });

    it("renders refresh icon in Try Again button", () => {
      render(<RouteError error={mockError} reset={mockReset} />);

      expect(screen.getByTestId("refresh-icon")).toBeInTheDocument();
    });

    it("renders home icon in Go to Dashboard button", () => {
      render(<RouteError error={mockError} reset={mockReset} />);

      expect(screen.getByTestId("home-icon")).toBeInTheDocument();
    });
  });

  describe("Re-render Behavior", () => {
    it("reports new error to Sentry when error changes", () => {
      const { rerender } = render(
        <RouteError error={mockError} reset={mockReset} />
      );

      expect(Sentry.captureException).toHaveBeenCalledTimes(1);

      const newError = new Error("New error");
      rerender(<RouteError error={newError} reset={mockReset} />);

      expect(Sentry.captureException).toHaveBeenCalledTimes(2);
      expect(Sentry.captureException).toHaveBeenLastCalledWith(newError, {
        tags: {
          component: "RouteError",
          route: expect.any(String),
        },
        extra: {
          url: expect.any(String),
          referrer: expect.any(String),
        },
      });
    });

    it("does not re-report same error on unrelated re-renders", () => {
      const { rerender } = render(
        <RouteError error={mockError} reset={mockReset} />
      );

      expect(Sentry.captureException).toHaveBeenCalledTimes(1);

      // Re-render with same error but different reset function
      const newReset = vi.fn();
      rerender(<RouteError error={mockError} reset={newReset} />);

      // Should still only be 1 call since error is the same
      expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    });
  });
});
