import { StrictMode } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { Eb2VsEb3 } from "../Eb2VsEb3";
import { twoLines } from "@/lib/__tests__/greenCardLine.fixture";

/**
 * What the reader is told, on the two-line India fixture. When a line may be
 * called shorter is pinned in `lib/greenCardLineCompare.test.ts`; these pin
 * that the page says it in words, and never says more.
 */

function setDate(value: string) {
  fireEvent.change(screen.getByLabelText(/priority date/i), { target: { value } });
}

describe("Eb2VsEb3", () => {
  it("asks for a date first", () => {
    render(<Eb2VsEb3 snapshot={twoLines(5000, 1000)} />);
    expect(screen.getByText(/pick a priority date/i)).toBeInTheDocument();
  });

  it("names the line with fewer people ahead, with both ranges", () => {
    render(<Eb2VsEb3 snapshot={twoLines(5000, 1000)} />);
    setDate("2031-01-01");
    expect(screen.getByText("EB-3 has fewer people ahead of you")).toBeInTheDocument();
    // 1,000 x 2.035-2.045 and 5,000 x 2.01-2.08, rounded to hundreds and thousands.
    expect(screen.getByText(/about 2,000 in EB-3 against about 10,000 in EB-2/)).toBeInTheDocument();
  });

  it("says too close to call when the ranges overlap", () => {
    render(<Eb2VsEb3 snapshot={twoLines(5000, 5000)} />);
    setDate("2031-01-01");
    expect(screen.getByText("Too close to call")).toBeInTheDocument();
    expect(screen.queryByText(/^EB-\d has fewer people ahead of you$/)).not.toBeInTheDocument();
  });

  it("says a current line is current, not that it has fewer people", () => {
    render(<Eb2VsEb3 snapshot={twoLines(5000, 1000, { eb2: { kind: "current" } })} />);
    setDate("2031-01-01");
    expect(screen.getByText("EB-2 is current for you; EB-3 isn't")).toBeInTheDocument();
  });

  it("prints each line's cutoffs as the bulletin states them", () => {
    render(<Eb2VsEb3 snapshot={twoLines(5000, 1000, { eb2: { kind: "unavailable" } })} />);
    setDate("2031-01-01");
    expect(screen.getByText("Unavailable")).toBeInTheDocument();
    expect(screen.getAllByText("Jan 1, 2013").length).toBeGreaterThan(0);
  });

  it("never turns the counts into years", () => {
    const { container } = render(<Eb2VsEb3 snapshot={twoLines(5000, 1000)} />);
    setDate("2031-01-01");
    expect(container.textContent).not.toMatch(/\d\s*years/);
  });
});

describe("a shared link", () => {
  afterEach(() => window.history.replaceState(null, "", "/"));

  it("opens on the country and date it names, and leaves the URL saying so (StrictMode runs effects twice)", () => {
    window.history.replaceState(null, "", "/tools/eb2-vs-eb3?country=china&pd=2021-03-01");
    render(
      <StrictMode>
        <Eb2VsEb3 snapshot={twoLines(5000, 1000)} />
      </StrictMode>,
    );
    expect((screen.getByLabelText("Country of chargeability") as HTMLSelectElement).value).toBe("china");
    expect((screen.getByLabelText(/priority date/i) as HTMLInputElement).value).toBe("2021-03-01");
    expect(window.location.search).toBe("?country=china&pd=2021-03-01");
  });
});
