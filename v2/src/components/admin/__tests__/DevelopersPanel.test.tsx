import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const summary = {
  accounts: [
    {
      account: "acct_a",
      plan: "Free",
      email: "dev@example.com",
      createdAt: Date.UTC(2026, 9, 1),
      activeKeys: 1,
      revokedKeys: 0,
      sandboxKeys: 1,
      endpoints: 2,
      pausedEndpoints: 1,
      watches: 3,
      calls30d: 40,
      callsYesterday: 4,
    },
  ],
  days: [{ day: "2026-10-08", keyed: 4, mcp: 2, extension: 1, other: 0 }],
  usageReadable: true,
  keys: { live: 1, sandbox: 1, byScope: { read: 2, export: 1, live_lookup: 1, webhooks: 1, cases_read: 0 } },
  webhooks: { endpoints: 2, paused: 1, pending: 0, held: 5, deliveredSince: 9, failedSince: 0, watches: 3 },
  live: { today: 12, yesterday: 30, ceiling: 20_000, readable: true },
};
vi.mock("convex/react", () => ({ useAction: () => () => Promise.resolve(summary) }));

const { DevelopersPanel } = await import("../DevelopersPanel");

describe("DevelopersPanel", () => {
  it("shows keys by scope, webhook health and live lookups against the ceiling", async () => {
    render(<DevelopersPanel />);
    await waitFor(() => expect(screen.getByText("12 of 20,000")).toBeInTheDocument());
    expect(screen.getByText(/Working keys by scope: read 2, export 1, live_lookup 1, webhooks 1, cases_read 0/)).toBeInTheDocument();
    expect(screen.getByText(/9 delivered, 0 failed\. 0 waiting, 5 held for paused endpoints, 3 watches/)).toBeInTheDocument();
    expect(screen.getByText(/1 endpoint is paused after a day of failures/)).toBeInTheDocument();
    expect(screen.getByText(/2 endpoints \(1 paused\), 3 watches/)).toBeInTheDocument();
  });
});
