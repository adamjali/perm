import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import type { SubscriptionState } from "@/lib/mailKinds";

let state: SubscriptionState | undefined;
const turnOff = vi.fn(() => Promise.resolve());
vi.mock("convex/react", () => ({
  useQuery: () => state,
  useMutation: () => turnOff,
}));

const toast = Object.assign(vi.fn(), { error: vi.fn() });
vi.mock("@/lib/toast", () => ({ toast }));

const { MailSubscriptionsCard } = await import("../MailSubscriptionsCard");

const EMPTY: SubscriptionState = {
  email: "someone@example.com",
  queueAlerts: [],
  caseAlerts: [],
  bulletinAlerts: [],
  employerAlerts: [],
  news: false,
  newsletter: false,
  weeklyDigest: true,
};

beforeEach(() => {
  state = undefined;
  turnOff.mockClear();
  toast.mockClear();
  toast.error.mockClear();
});

describe("MailSubscriptionsCard", () => {
  it("shows a placeholder while the list loads", () => {
    const { container } = render(<MailSubscriptionsCard email="someone@example.com" />);
    expect(container.querySelector('[data-slot="skeleton"], .animate-pulse')).not.toBeNull();
  });

  it("says plainly when the address has no alerts, and links to what exists", () => {
    state = EMPTY;
    render(<MailSubscriptionsCard email="someone@example.com" />);
    expect(screen.getByText(/None on this address/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See what you can get" })).toHaveAttribute("href", "/email-preferences");
  });

  it("lists active alerts and digests, never the account's own case summary", () => {
    state = {
      ...EMPTY,
      caseAlerts: [
        { id: "c1", caseNumber: "G-100-26125-868956", active: true },
        { id: "c2", caseNumber: "G-100-26125-000001", active: false },
      ],
      newsletter: true,
    };
    render(<MailSubscriptionsCard email="someone@example.com" />);
    expect(screen.getByText("G-100-26125-868956")).toBeInTheDocument();
    expect(screen.queryByText("G-100-26125-000001")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /turn off/i })).toHaveLength(2);
  });

  it("turns one alert off by its kind and id, and says so", async () => {
    state = { ...EMPTY, caseAlerts: [{ id: "c1", caseNumber: "G-100-26125-868956", active: true }] };
    render(<MailSubscriptionsCard email="someone@example.com" />);
    fireEvent.click(screen.getByRole("button", { name: /turn off/i }));
    await waitFor(() => expect(turnOff).toHaveBeenCalledWith({ kind: "case", id: "c1" }));
    expect(toast).toHaveBeenCalled();
  });

  it("reports a failed save instead of pretending", async () => {
    state = { ...EMPTY, caseAlerts: [{ id: "c1", caseNumber: "G-100-26125-868956", active: true }] };
    turnOff.mockImplementationOnce(() => Promise.reject(new Error("offline")));
    render(<MailSubscriptionsCard email="someone@example.com" />);
    fireEvent.click(screen.getByRole("button", { name: /turn off/i }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
  });
});
