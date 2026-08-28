// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../../../../../test-utils/render-utils";
import SecurityDashboardClient from "../SecurityDashboardClient";

vi.mock("@/lib/admin/adminAuth", () => ({
  useAdminAuth: () => ({ isAdmin: true, isLoading: false, isSigningOut: false, user: null }),
}));

vi.mock("convex/react", () => ({
  useQuery: () => undefined,
  useMutation: () => vi.fn(),
}));

vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
  updateToastAuthState: vi.fn(),
}));

/**
 * /admin/security was a one-way door: the admin dashboard linked into it and
 * the page offered no route out, so the only exit was the browser button.
 */
describe("SecurityDashboardClient", () => {
  it("links back to the admin dashboard", () => {
    renderWithProviders(<SecurityDashboardClient />);

    const back = screen.getByRole("link", { name: /admin dashboard/i });
    expect(back).toHaveAttribute("href", "/admin");
  });

  it("still renders its own heading and tabs", () => {
    renderWithProviders(<SecurityDashboardClient />);

    expect(screen.getByRole("heading", { name: /security ops/i })).toBeInTheDocument();
    expect(screen.getAllByRole("tab")).toHaveLength(4);
  });
});
