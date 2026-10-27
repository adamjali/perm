import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockUseQuery = vi.fn();
vi.mock("convex/react", () => ({ useQuery: () => mockUseQuery() }));
vi.mock("@/lib/analytics", () => ({ analytics: { capture: vi.fn() } }));

import AudienceBanner from "../AudienceBanner";

/**
 * The tape replaced the box in front of the sign-up form (Oct 26 2026): it shows inside the app to someone who
 * said they're waiting on their own case or chose Other, and to nobody who files cases.
 */
describe("AudienceBanner", () => {
  const realStorage = window.localStorage;
  const profile = (jobTitle?: string) => ({ _id: "profile_1", jobTitle });
  const banner = () => screen.queryByRole("region", { name: /who this app is for/i });

  beforeEach(() => {
    window.localStorage.clear();
  });
  afterEach(() => {
    Object.defineProperty(window, "localStorage", { value: realStorage, configurable: true });
  });

  it.each(["Waiting on my own case", "Other"])("shows for %s, with the case lookup and a way to change the role", (role) => {
    mockUseQuery.mockReturnValue(profile(role));
    render(<AudienceBanner />);
    expect(banner()).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /check my case/i })).toHaveAttribute("href", "/perm-case-status");
    expect(screen.getByRole("link", { name: /i file cases/i })).toHaveAttribute("href", "/settings#role");
  });

  it.each([["Immigration Attorney"], ["Paralegal"], ["HR Professional"], ["Employer/Petitioner"], ["Global Mobility counsel"], [undefined]])(
    "stays away from %s",
    (role) => {
      mockUseQuery.mockReturnValue(profile(role));
      render(<AudienceBanner />);
      expect(banner()).not.toBeInTheDocument();
    },
  );

  it("renders nothing while the profile loads", () => {
    mockUseQuery.mockReturnValue(undefined);
    render(<AudienceBanner />);
    expect(banner()).not.toBeInTheDocument();
  });

  it("stays closed for this account once closed", async () => {
    mockUseQuery.mockReturnValue(profile("Waiting on my own case"));
    const { unmount } = render(<AudienceBanner />);
    await userEvent.click(screen.getByRole("button", { name: /close this notice/i }));
    expect(banner()).not.toBeInTheDocument();
    unmount();
    render(<AudienceBanner />);
    expect(banner()).not.toBeInTheDocument();
  });

  it("still shows, and still closes, when the browser refuses storage", async () => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new Error("SecurityError");
      },
    });
    mockUseQuery.mockReturnValue(profile("Other"));
    render(<AudienceBanner />);
    expect(banner()).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /close this notice/i }));
    expect(banner()).not.toBeInTheDocument();
  });
});
