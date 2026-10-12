// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../../../../../test-utils/render-utils";
import SecurityDashboardClient from "../SecurityDashboardClient";

vi.mock("@/lib/admin/adminAuth", () => ({
  useAdminAuth: () => ({ isAdmin: true, isLoading: false, isSigningOut: false, user: null }),
}));

const queryResult = vi.hoisted(() => ({ value: undefined as unknown }));
vi.mock("convex/react", () => ({
  // The summary query reads an object; the events query reads a list.
  useQuery: (_fn: unknown, args?: { limit?: number }) => (args?.limit ? queryResult.value : undefined),
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

    expect(screen.getByRole("heading", { name: /^security$/i })).toBeInTheDocument();
    expect(screen.getAllByRole("tab")).toHaveLength(4);
  });

  it("names a counted attempt as counted, never as a refusal", () => {
    // Every sign-in is a row in the limits table. Printed as RATE_LIMIT, the
    // owner's own successful sign-in read as blocked.
    queryResult.value = [
      { kind: "rate_limit", id: "rl_1", at: Date.UTC(2026, 9, 12, 9, 26), actor: "someone@example.com", endpoint: "login", reason: "login:someone@example.com", severity: "info" },
      { kind: "strike", id: "rl_2", at: Date.UTC(2026, 9, 12, 9, 20), ip: "203.0.113.9", endpoint: "ip_strike", reason: "ip_strike:203.0.113.9", severity: "warning" },
    ];
    renderWithProviders(<SecurityDashboardClient />);
    expect(screen.getByText("Counted")).toBeInTheDocument();
    expect(screen.getByText("Strike")).toBeInTheDocument();
    expect(screen.queryByText(/rate_limit/i)).not.toBeInTheDocument();
    queryResult.value = undefined;
  });
});
