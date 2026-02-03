// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../../../test-utils/render-utils";
import { createMockUser, NAV_LINKS } from "../../../../test-utils/ui-fixtures";
import Header from "../Header";
import ThemeToggle from "../ThemeToggle";

const mockPathname = vi.fn(() => "/dashboard");
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
  useRouter: () => ({ push: mockPush }),
}));

const mockUseQuery = vi.fn();
const mockUseMutation = vi.fn(() => vi.fn());
vi.mock("convex/react", () => ({
  useQuery: () => mockUseQuery(),
  useMutation: () => mockUseMutation(),
}));

const mockSignOut = vi.fn();
vi.mock("@convex-dev/auth/react", () => ({
  useAuthActions: () => ({ signOut: mockSignOut }),
}));

vi.mock("@/hooks", () => ({ useNotificationToasts: vi.fn() }));
vi.mock("@/components/notifications", () => ({
  NotificationBell: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="notification-bell">{children}</div>
  ),
  NotificationDropdown: () => <div data-testid="notification-dropdown" />,
}));
vi.mock("@/lib/contexts/AuthContext", () => ({
  useAuthContext: () => ({ isSigningOut: false, beginSignOut: vi.fn(), cancelSignOut: vi.fn() }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

import React from "react";

describe("Header", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname.mockReturnValue("/dashboard");
    mockUseQuery.mockReturnValue(createMockUser());
  });

  it("renders logo linking to /dashboard and all nav links", () => {
    renderWithProviders(<Header />);
    expect(screen.getByRole("link", { name: /perm/i })).toHaveAttribute("href", "/dashboard");
    NAV_LINKS.forEach((link) => {
      const navLink = screen.getByRole("link", { name: link.label });
      expect(navLink).toHaveAttribute("href", link.href);
    });
  });

  it("renders theme toggle and user name when authenticated", () => {
    mockUseQuery.mockReturnValue(createMockUser({ name: "Jane Attorney" }));
    renderWithProviders(<Header />);
    expect(screen.getByRole("button", { name: /switch to .* mode/i })).toBeInTheDocument();
    expect(screen.getByText("Jane Attorney")).toBeInTheDocument();
  });

  it("does not display user name when not authenticated", () => {
    mockUseQuery.mockReturnValue(undefined);
    renderWithProviders(<Header />);
    expect(screen.queryByText("Test User")).not.toBeInTheDocument();
  });

  describe("active navigation state", () => {
    it.each([
      ["/dashboard", "Dashboard"],
      ["/cases", "Cases"],
      ["/calendar", "Calendar"],
      ["/timeline", "Timeline"],
    ])("highlights %s link on %s route", (path, label) => {
      mockPathname.mockReturnValue(path);
      renderWithProviders(<Header />);
      expect(screen.getByRole("link", { name: label })).toHaveClass("text-primary");
    });

    it("does not highlight non-active links", () => {
      mockPathname.mockReturnValue("/dashboard");
      renderWithProviders(<Header />);
      expect(screen.getByRole("link", { name: "Cases" })).not.toHaveClass("text-primary");
      expect(screen.getByRole("link", { name: "Calendar" })).not.toHaveClass("text-primary");
    });
  });

  it("uses semantic header and nav elements", () => {
    const { container } = renderWithProviders(<Header />);
    expect(container.querySelector("header")).toBeInTheDocument();
    expect(container.querySelector("nav")).toBeInTheDocument();
  });
});

describe("ThemeToggle", () => {
  it("renders accessible button with aria-label", () => {
    renderWithProviders(<ThemeToggle />);
    const button = screen.getByRole("button", { name: /switch to .* mode/i });
    expect(button).toHaveAttribute("aria-label");
    expect(button).toHaveAttribute("type", "button");
  });

  it.each([
    ["dark", /switch to light mode/i],
    ["light", /switch to dark mode/i],
  ] as const)("shows correct label in %s mode", (theme, expectedLabel) => {
    renderWithProviders(<ThemeToggle />, { providerProps: { theme } });
    expect(screen.getByRole("button", { name: expectedLabel })).toBeInTheDocument();
  });
});
