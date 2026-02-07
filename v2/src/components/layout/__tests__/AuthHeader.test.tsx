// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "../../../../test-utils/render-utils";
import AuthHeader from "../AuthHeader";
import { CONTENT_NAV_LINKS } from "@/lib/constants/navigation";

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

  it("renders Learn dropdown button on home page", () => {
    vi.mocked(usePathname).mockReturnValue("/");
    renderWithProviders(<AuthHeader />);

    const learnButtons = screen.getAllByRole("button", { name: /learn/i });
    // Desktop nav has a Learn button with aria-expanded
    const learnButton = learnButtons.find(
      (btn) => btn.getAttribute("aria-expanded") !== null
    );
    expect(learnButton).toBeDefined();
    expect(learnButton).toHaveAttribute("aria-expanded", "false");
  });

  it("opens Learn dropdown on click and shows content links", async () => {
    vi.mocked(usePathname).mockReturnValue("/");
    const { user } = renderWithProviders(<AuthHeader />);

    const learnButtons = screen.getAllByRole("button", { name: /learn/i });
    const learnButton = learnButtons.find(
      (btn) => btn.getAttribute("aria-expanded") !== null
    )!;

    await user.click(learnButton);

    expect(learnButton).toHaveAttribute("aria-expanded", "true");

    // All content nav links should be visible in the dropdown
    for (const link of CONTENT_NAV_LINKS) {
      expect(screen.getByRole("link", { name: link.label })).toBeInTheDocument();
    }
  });

  it("closes Learn dropdown on click outside", async () => {
    vi.mocked(usePathname).mockReturnValue("/");
    const { user } = renderWithProviders(<AuthHeader />);

    const learnButtons = screen.getAllByRole("button", { name: /learn/i });
    const learnButton = learnButtons.find(
      (btn) => btn.getAttribute("aria-expanded") !== null
    )!;

    // Open the dropdown
    await user.click(learnButton);
    expect(learnButton).toHaveAttribute("aria-expanded", "true");

    // Simulate clicking outside (mousedown on document body)
    fireEvent.mouseDown(document.body);

    expect(learnButton).toHaveAttribute("aria-expanded", "false");
  });

  it("closes Learn dropdown when a link inside it is clicked", async () => {
    vi.mocked(usePathname).mockReturnValue("/");
    const { user } = renderWithProviders(<AuthHeader />);

    const learnButtons = screen.getAllByRole("button", { name: /learn/i });
    const learnButton = learnButtons.find(
      (btn) => btn.getAttribute("aria-expanded") !== null
    )!;

    // Open the dropdown
    await user.click(learnButton);
    expect(learnButton).toHaveAttribute("aria-expanded", "true");

    // Click the first content link (e.g., "Blog")
    const firstLink = screen.getByRole("link", { name: CONTENT_NAV_LINKS[0].label });
    await user.click(firstLink);

    expect(learnButton).toHaveAttribute("aria-expanded", "false");
  });
});
