import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { SubscriptionsPanel, type Signals } from "../SignalsPanel";

/**
 * Every subscription row says when its person signed up, when they
 * confirmed, and how long after signing up the alert reached them. The row
 * used to print one unlabelled date with "alerted" beside it (Oct 7 2026).
 */

const T = Date.parse("2026-09-28T14:00:00Z");
const sub = {
  email: "waiting@example.com",
  subject: "G-100-25335-445491",
  status: "confirmed" as const,
  createdAt: T,
  lastNotifiedAt: T + 9 * 86_400_000,
  confirmedAt: T + 8 * 60_000,
  unsubscribedAt: null,
  alertCount: 1,
  lastSeen: "CERTIFIED",
  source: "perm-case-status",
};
const signals = {
  subscriptions: { caseAlerts: [sub], employerAlerts: [], queueAlerts: [], bulletinAlerts: [], news: [] },
} as unknown as Signals;

describe("SubscriptionsPanel", () => {
  it("labels the sign-up, the confirmation and the alert, with the time between", () => {
    render(<SubscriptionsPanel signals={signals} />);
    fireEvent.click(screen.getByText("Case status alerts"));
    const line = screen.getByText(/^Signed up/);
    expect(line.textContent).toContain("confirmed 8 minutes later");
    expect(line.textContent).toContain("9 days after signing up");
    expect(line.textContent).toContain("last seen CERTIFIED");
    expect(line.textContent).toContain("from the PERM case page");
  });
});
