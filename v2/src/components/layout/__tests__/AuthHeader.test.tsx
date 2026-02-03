// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../../../test-utils/render-utils";
import AuthHeader from "../AuthHeader";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
}));

import { usePathname } from "next/navigation";

describe("AuthHeader", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders logo linking to home and theme toggle", () => {
    vi.mocked(usePathname).mockReturnValue("/");
    renderWithProviders(<AuthHeader />);

    const logoLink = screen.getByRole("link", { name: /perm/i });
    expect(logoLink).toHaveAttribute("href", "/");
    expect(screen.getAllByRole("button", { name: /switch to .* mode/i }).length).toBeGreaterThanOrEqual(1);
  });

  it.each([
    ["/login", false, true],   // On login: hide Sign In, show Sign Up
    ["/signup", true, false],  // On signup: show Sign In, hide Sign Up
    ["/", true, true],         // On home: show both
    ["/demo", true, true],     // On demo: show both
  ])("on %s shows Sign In=%s, Sign Up=%s", (path, showSignIn, showSignUp) => {
    vi.mocked(usePathname).mockReturnValue(path);
    renderWithProviders(<AuthHeader />);

    if (showSignIn) {
      expect(screen.getByRole("link", { name: /sign in/i })).toBeInTheDocument();
    } else {
      expect(screen.queryByRole("link", { name: /sign in/i })).not.toBeInTheDocument();
    }
    if (showSignUp) {
      expect(screen.getByRole("link", { name: /sign up/i })).toBeInTheDocument();
    } else {
      expect(screen.queryByRole("link", { name: /sign up/i })).not.toBeInTheDocument();
    }
  });
});
