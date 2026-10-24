import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AlertRatingsPanel, type AlertRatingsData } from "../AlertRatingsPanel";

const PHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1";
const AT = Date.UTC(2026, 9, 24, 6, 42);

const row = (over: Partial<AlertRatingsData[number]> = {}): AlertRatingsData[number] => ({
  id: "r1" as AlertRatingsData[number]["id"],
  email: "pat@example.com",
  caseNumber: "G-100-25356-503779",
  anonymous: false,
  score: 5,
  note: null,
  clicks: [
    { score: 1, at: AT - 600_000, via: "email", browser: "python-requests/2.32", scanner: true },
    { score: 5, at: AT, via: "email", browser: PHONE },
  ],
  createdAt: AT - 600_000,
  updatedAt: AT,
  name: "Pat Lee",
  watch: {
    signedUpAt: AT - 86_400_000,
    confirmedAt: AT - 86_000_000,
    source: "case-page",
    lastSeenStatus: "CERTIFIED",
    alertCount: 1,
    lastAlertSentAt: AT - 60_000,
    unsubscribedAt: null,
  },
  review: { status: "pending", rating: 5, at: AT + 60_000 },
  ...over,
});

describe("AlertRatingsPanel", () => {
  it("shows a rating with who gave it, the case, the watch, their review and every open", () => {
    render(<AlertRatingsPanel data={[row()]} />);
    expect(screen.getByText("5 of 5")).toBeTruthy();
    expect(screen.getByText(/Pat Lee, pat@example\.com/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "G-100-25356-503779" }).getAttribute("href")).toBe("/perm-case-status?case=G-100-25356-503779");
    expect(screen.getByText(/1 sent, the last/)).toBeTruthy();
    expect(screen.getByText(/5 of 5, pending/)).toBeTruthy();
    expect(screen.getByText("Every open and tap (2, 1 by a scanner)")).toBeTruthy();
    expect(screen.getByText(/Safari on iPhone/)).toBeTruthy();
    expect(screen.getByText(/\(scanner, not counted\)/)).toBeTruthy();
  });

  it("says so when only a scanner opened the links, and hides an anonymous rater", () => {
    render(<AlertRatingsPanel data={[row({ score: null, anonymous: true, email: null, name: null, caseNumber: null, watch: null })]} />);
    expect(screen.getByText(/only a mail scanner opened the links/)).toBeTruthy();
    expect(screen.getByText("Asked to leave their email off")).toBeTruthy();
  });

  it("says when there are none", () => {
    render(<AlertRatingsPanel data={[]} />);
    expect(screen.getByText("No ratings yet.")).toBeTruthy();
  });
});
