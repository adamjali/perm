import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";

import { BulletinBoard } from "../BulletinBoard";
import type { BulletinBoard as Board, BoardCell } from "@/lib/turso/bulletin";

/**
 * The board's job is a comparison, so what it must never do is show a pace
 * next to a queue that has no pace and let the reader assume the blank means
 * zero. Every cell that cannot be measured is listed with the reason.
 */

function cell(over: Partial<BoardCell> & Pick<BoardCell, "category" | "country">): BoardCell {
  return {
    latest: { kind: "date", iso: "2014-01-01" },
    latestMonth: "2026-09",
    movedDays: 610,
    spanMonths: 35,
    pace: 0.57,
    retrogressions: [],
    states: [],
    ...over,
  };
}

function board(cells: BoardCell[]): Board {
  return {
    firstMonth: "2023-10",
    lastMonth: "2026-09",
    bulletinCount: 36,
    categories: [...new Set(cells.map((c) => c.category))],
    finalAction: cells,
    datesForFiling: [
      cell({ category: "EB2", country: "india", pace: 1.4, latest: { kind: "current" } }),
    ],
  };
}

describe("BulletinBoard: the pace", () => {
  it("ranks the queues and says how many lost ground", () => {
    render(
      <BulletinBoard
        board={board([
          cell({ category: "EB3", country: "india", pace: 0.57 }),
          cell({ category: "EB1", country: "india", pace: 1.98 }),
          cell({ category: "EB2", country: "china", pace: 0.66 }),
        ])}
      />,
    );
    expect(screen.getByText("1.98x")).toBeInTheDocument();
    // The count is the finding: forward movement is not the same as a
    // shortening queue, and most of these queues lengthened.
    expect(screen.getByText(/2 of the 3 queues measured here moved slower/i)).toBeInTheDocument();
  });

  it("puts the fastest queue first", () => {
    const { container } = render(
      <BulletinBoard
        board={board([
          cell({ category: "EB3", country: "india", pace: 0.57 }),
          cell({ category: "EB1", country: "india", pace: 1.98 }),
        ])}
      />,
    );
    const rows = [...container.querySelectorAll("li")].filter((li) =>
      /x$/.test(li.textContent!.trim()),
    );
    expect(rows[0]!.textContent).toContain("1.98x");
  });

  it("lists a withheld queue with its reason instead of dropping it", () => {
    // Dropping it silently would make the chart look like the whole board
    // when it is a subset of it.
    render(
      <BulletinBoard
        board={board([
          cell({ category: "EB2", country: "india", pace: null, latest: { kind: "unavailable" } }),
          cell({ category: "EB1", country: "worldwide", pace: null, movedDays: null, latest: { kind: "current" } }),
        ])}
      />,
    );
    const heading = screen.getByText(/queues with no pace to report/i);
    const block = heading.closest("div")!;
    expect(within(block).getByText(/EB-2 India/)).toBeInTheDocument();
    expect(within(block).getByText(/was closed in September 2026/)).toBeInTheDocument();
    expect(within(block).getByText(/published no cutoff date in this window/)).toBeInTheDocument();
  });

  it("reports a shut queue's movement without reporting its pace", () => {
    render(
      <BulletinBoard
        board={board([
          cell({ category: "EB2", country: "india", pace: null, movedDays: 609, latest: { kind: "unavailable" } }),
        ])}
      />,
    );
    expect(screen.getByText(/after advancing 1 year 8 months/)).toBeInTheDocument();
    expect(screen.queryByText(/x pace/)).not.toBeInTheDocument();
  });
});

describe("BulletinBoard: the table", () => {
  it("names the two non-date states in words, not by colour alone", () => {
    render(
      <BulletinBoard
        board={board([
          cell({ category: "EB1", country: "worldwide", latest: { kind: "current" }, pace: null, movedDays: null }),
          cell({ category: "EB2", country: "india", latest: { kind: "unavailable" }, pace: null }),
        ])}
      />,
    );
    const table = screen.getByRole("table");
    expect(within(table).getByText("Current")).toBeInTheDocument();
    expect(within(table).getByText("Closed")).toBeInTheDocument();
  });

  it("marks a country the archive does not publish for a category", () => {
    // Two categories, one country each, so every row has a hole in it. A
    // blank cell reads as a zero.
    render(
      <BulletinBoard
        board={board([
          cell({ category: "EB1", country: "india" }),
          cell({ category: "EB2", country: "china" }),
        ])}
      />,
    );
    expect(screen.getAllByText("Not held").length).toBe(2);
  });
});

describe("BulletinBoard: the chart switch", () => {
  it("re-reads the whole board when the chart changes", () => {
    render(
      <BulletinBoard
        board={board([cell({ category: "EB3", country: "india", pace: 0.57 })])}
      />,
    );
    expect(screen.getByText("0.57x")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /dates for filing/i }));
    expect(screen.queryByText("0.57x")).not.toBeInTheDocument();
    expect(screen.getByText("1.40x")).toBeInTheDocument();
  });
});
