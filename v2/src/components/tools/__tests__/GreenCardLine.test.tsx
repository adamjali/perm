import { StrictMode } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { GreenCardLine, formatYears, roundPeople } from "../GreenCardLine";
import { lineSnapshot } from "@/lib/__tests__/greenCardLine.fixture";

/**
 * The calculator's four states, on the made-up EB-3 Other Workers line the
 * model tests use (5,000 principals behind a 1 April 2022 cutoff, 2,000 visas
 * a year). The arithmetic is pinned in `lib/greenCardLine.test.ts`; these pin
 * what reaches the reader.
 */

function renderLine(snapshot = lineSnapshot()) {
  return render(
    <GreenCardLine snapshot={snapshot} pace={{}} defaultCategory="EW3" defaultCountry="worldwide" />,
  );
}

function setDate(value: string) {
  fireEvent.change(screen.getByLabelText(/priority date/i), { target: { value } });
}

describe("GreenCardLine", () => {
  it("asks for a date before it says anything", () => {
    renderLine();
    expect(screen.getByText(/pick a priority date/i)).toBeInTheDocument();
    expect(screen.queryByText("people ahead of you")).not.toBeInTheDocument();
  });

  it("says current, not a count, for a date before the cutoff", () => {
    renderLine();
    setDate("2021-12-15");
    expect(screen.getByText(/your priority date is current/i)).toBeInTheDocument();
    expect(screen.queryByText("people ahead of you")).not.toBeInTheDocument();
  });

  it("gives a range, last year's green cards as a fact, and the three groups", () => {
    const { container } = renderLine();
    setDate("2024-06-01");
    expect(screen.getByText("people ahead of you")).toBeInTheDocument();
    expect(screen.getByText(/green cards went to this line and country in fiscal 2024/i)).toBeInTheDocument();
    for (const g of [/current, not finished/i, /approved, waiting for the bulletin/i, /waiting for I-140 approval/i]) {
      expect(screen.getByText(g)).toBeInTheDocument();
    }
    // The method sits behind a disclosure, shut.
    const details = [...container.querySelectorAll("details")];
    expect(details.length).toBe(2);
    expect(details.every((d) => !d.open)).toBe(true);
  });

  it("doesn't turn the count into years unless the page asks it to", () => {
    // The site's published rule (the EB-2 India guide) is that it doesn't
    // divide a count by a yearly supply. Reversing it is one prop, on purpose.
    renderLine();
    setDate("2024-06-01");
    expect(screen.queryByText(/years$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/pace:/i)).not.toBeInTheDocument();
  });

  it("prints years at last year's pace when the page opts in", () => {
    render(<GreenCardLine snapshot={lineSnapshot()} pace={{}} defaultCategory="EW3" defaultCountry="worldwide" showYears />);
    setDate("2024-06-01");
    expect(screen.getByText(/at FY2024's pace/i)).toBeInTheDocument();
  });

  it("says nothing about supply rather than invent one it doesn't hold", () => {
    renderLine(lineSnapshot({ supply: null }));
    setDate("2024-06-01");
    expect(screen.getByText("people ahead of you")).toBeInTheDocument();
    expect(screen.queryByText(/table v/i)).not.toBeInTheDocument();
  });

  it("refuses in words when USCIS's count is missing", () => {
    renderLine(lineSnapshot({ awaiting: null }));
    setDate("2024-06-01");
    expect(screen.queryByText("people ahead of you")).not.toBeInTheDocument();
    expect(screen.getByText(/USCIS/)).toBeInTheDocument();
  });

  it("gives each chart its own title id, so two calculators can share a page", () => {
    const { container } = render(
      <>
        <GreenCardLine snapshot={lineSnapshot()} pace={{}} defaultCategory="EW3" defaultCountry="worldwide" />
        <GreenCardLine snapshot={lineSnapshot()} pace={{}} defaultCategory="EW3" defaultCountry="worldwide" />
      </>,
    );
    for (const input of screen.getAllByLabelText(/priority date/i)) {
      fireEvent.change(input, { target: { value: "2024-06-01" } });
    }
    const ids = [...container.querySelectorAll("svg title[id]")].map((t) => t.id);
    expect(ids.length).toBe(2);
    expect(new Set(ids).size).toBe(2);
  });
});

describe("a shared link", () => {
  afterEach(() => window.history.replaceState(null, "", "/"));

  it("opens on the line and date it names, and leaves the URL saying so (StrictMode runs effects twice)", () => {
    window.history.replaceState(null, "", "/tools/green-card-line?category=EW3&country=worldwide&pd=2023-05-01");
    render(
      <StrictMode>
        <GreenCardLine snapshot={lineSnapshot()} pace={{}} />
      </StrictMode>,
    );
    expect((screen.getByLabelText("Category") as HTMLSelectElement).value).toBe("EW3");
    expect((screen.getByLabelText("Country of chargeability") as HTMLSelectElement).value).toBe("worldwide");
    expect((screen.getByLabelText(/priority date/i) as HTMLInputElement).value).toBe("2023-05-01");
    expect(window.location.search).toBe("?category=EW3&country=worldwide&pd=2023-05-01");
  });
});

describe("rounding a count this uncertain", () => {
  it.each([
    [44, "40"],
    [1234, "1,200"],
    [42398, "42,000"],
  ])("%d reads %s", (n, out) => {
    expect(roundPeople(n)).toBe(out);
  });

  it("caps years rather than print a century", () => {
    expect(formatYears(3.46)).toBe("3.5");
    expect(formatYears(31.7)).toBe("32");
    expect(formatYears(140)).toBe("more than 99");
  });
});
