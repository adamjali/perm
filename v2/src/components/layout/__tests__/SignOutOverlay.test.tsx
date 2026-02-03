/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, render } from "@testing-library/react";
import SignOutOverlay from "../SignOutOverlay";

const mockIsSigningOut = vi.fn(() => false);

vi.mock("@/lib/contexts/AuthContext", () => ({
  useAuthContext: () => ({
    isSigningOut: mockIsSigningOut(),
    authState: mockIsSigningOut() ? "signingOut" : "idle",
    beginSignOut: vi.fn(),
    completeSignOut: vi.fn(),
    cancelSignOut: vi.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe("SignOutOverlay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsSigningOut.mockReturnValue(false);
  });

  it("renders nothing when not signing out", () => {
    const { container } = render(<SignOutOverlay />);
    expect(container.firstChild).toBeNull();
  });

  it("renders accessible overlay with spinner when signing out", () => {
    mockIsSigningOut.mockReturnValue(true);
    const { container } = render(<SignOutOverlay />);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-label", "Signing out");
    expect(screen.getByText("Signing out...")).toBeInTheDocument();
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });
});
