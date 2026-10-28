import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { BacklogMonth } from "@/lib/backlogMonths";

import { QueueDayPicker } from "../QueueDayPicker";

const month = (m: string, pending: number, decided = 0): BacklogMonth => ({
  month: m,
  total: pending + decided,
  pending,
  decided,
  decidedPct: pending + decided ? (decided / (pending + decided)) * 100 : null,
  statuses: [
    { status: "ANALYST REVIEW", count: pending, isFinal: false },
    ...(decided ? [{ status: "CERTIFIED", count: decided, isFinal: true }] : []),
  ],
});

const today = {
  months: [month("2025-12", 100, 900), month("2026-01", 600)],
  frontierMonth: "2025-12",
  frontierAsOf: "October 5, 2026",
  frontMonth: "2025-12",
};
const past = { day: "2026-09-02", months: [month("2025-12", 700, 300), month("2026-01", 640)], dol: { month: "2025-11", asOf: "2026-08-31" } };

afterEach(() => vi.unstubAllGlobals());

describe("QueueDayPicker", () => {
  it("with no past days, is today's wall and nothing more", () => {
    render(<QueueDayPicker days={[]} today={today} />);
    expect(screen.queryByRole("slider")).toBeNull();
    expect(screen.getByText("600")).toBeInTheDocument();
  });

  it("steps to a past day, draws its bars with today's outlined, and returns", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(past), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    render(<QueueDayPicker days={["2026-09-01", "2026-09-02"]} today={today} />);
    expect(screen.getByRole("slider")).toHaveAttribute("aria-valuetext", "Today");

    fireEvent.click(screen.getByRole("button", { name: "A day earlier" }));
    await waitFor(() => expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/queue-day?day=2026-09-02"));
    await screen.findByText("1,340 cases still pending at the end of September 2, 2026, against 700 today.");
    expect(screen.getByRole("slider")).toHaveAttribute("aria-valuetext", "September 2, 2026");
    expect(screen.getByText("Today", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByRole("listitem", { name: /December 2025: 700 of 1,000 still waiting.*100 today/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Back to today" }));
    await waitFor(() => expect(screen.getByRole("slider")).toHaveAttribute("aria-valuetext", "Today"));
    expect(screen.queryByText(/cases still pending at the end of/)).toBeNull();
  });

  it("asks once the slider rests: quick steps are one request, for the day it stops on", async () => {
    const fetchMock = vi.fn(async (url: string) => new Response(JSON.stringify({ ...past, day: url.slice(-10) }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<QueueDayPicker days={["2026-09-01", "2026-09-02"]} today={today} />);
    fireEvent.click(screen.getByRole("button", { name: "A day earlier" }));
    fireEvent.click(screen.getByRole("button", { name: "A day earlier" }));
    await screen.findByText(/at the end of September 1, 2026/);
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual(["/api/queue-day?day=2026-09-01"]);
  });

  it("says so when a day can't be read, and offers to try again", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "the queue for that day couldn't be read" }), { status: 503 })));
    render(<QueueDayPicker days={["2026-09-02"]} today={today} />);
    fireEvent.click(screen.getByRole("button", { name: "A day earlier" }));
    expect(await screen.findByRole("button", { name: /try again/i })).toBeInTheDocument();
  });
});
