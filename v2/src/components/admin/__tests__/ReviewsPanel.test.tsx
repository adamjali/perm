import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("convex/react", () => ({ useMutation: () => vi.fn(async () => null) }));

import { ReviewsPanel, type ReviewsData } from "../ReviewsPanel";

/**
 * Admin > Reviews: everything waiting first, where each came from, and a filter for what's posted and what was
 * declined (owner, Oct 31 2026: an alert rating sat unseen and there was no way to tell posted from not).
 */

type Row = ReviewsData["waiting"][number];
const AT = Date.UTC(2026, 9, 28, 13, 59);

const row = (over: Partial<Row>): Row => ({
  _id: "x" as Row["_id"],
  rating: 5,
  text: "",
  name: "Case alert reader",
  status: "pending",
  source: "alert",
  insider: false,
  watchesCase: true,
  quick: false,
  viaLink: false,
  scrubbed: false,
  createdAt: AT,
  ...over,
});

const data: ReviewsData = {
  waiting: [row({ _id: "w1" as Row["_id"], rater: { email: "reader@example.com", caseNumber: "G-100-26029-601942" } })],
  decided: [
    row({ _id: "p1" as Row["_id"], status: "approved", source: "site", name: "Pat", text: "Helpful.", rating: 4, reviewedAt: AT }),
    row({ _id: "d1" as Row["_id"], status: "declined", source: "site", name: "Spam Bot", text: "Buy now", rating: 1, declineReason: "spam", reviewedAt: AT }),
  ],
};

describe("ReviewsPanel", () => {
  it("puts what waits first and says an alert rating came from the email", () => {
    render(<ReviewsPanel data={data} />);
    const waiting = screen.getByRole("heading", { name: "Waiting for you: 1" }).closest("section")!;
    expect(within(waiting).getByText("Case alert reader, 5 of 5")).toBeTruthy();
    expect(within(waiting).getByText(/tapped in a case's alert email/)).toBeTruthy();
    expect(within(waiting).getByText("reader@example.com, watching G-100-26029-601942 (only you see this)")).toBeTruthy();
  });

  it("filters to what's posted and to what was kept off, with counts on each choice", () => {
    render(<ReviewsPanel data={data} />);
    const posted = screen.getByRole("button", { name: "Posted (1)" });
    fireEvent.click(posted);
    expect(posted.getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByRole("heading", { name: /Waiting for you/ })).toBeNull();
    expect(screen.getByText("Pat, 4 of 5")).toBeTruthy();
    expect(screen.queryByText("Spam Bot, 1 of 5")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Declined or kept off (1)" }));
    expect(screen.getByText("Spam Bot, 1 of 5")).toBeTruthy();
    expect(screen.queryByText("Pat, 4 of 5")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Waiting (1)" }));
    expect(screen.getByText("Case alert reader, 5 of 5")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Decided" })).toBeNull();
  });
});
