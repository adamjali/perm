import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CspaCalculator } from "../CspaCalculator";

/** The age-out calculator asks for one bulletin line and draws the rule's answer; a line that didn't load says why. */

const realFetch = global.fetch;
afterEach(() => {
  global.fetch = realFetch;
});

function line(cells: Record<string, string>) {
  return {
    ok: true,
    line: {
      set: "employment",
      category: "EB2",
      country: "india",
      months: Object.entries(cells).map(([month, fa]) => ({ month, finalAction: fa, datesForFiling: null })),
    },
  };
}

function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

describe("the CSPA calculator", () => {
  it("asks for the chosen line and says when the visa has to come", async () => {
    // Arrange: the Final Action chart never reached a 2016 date.
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(line({ "2026-10": "15DEC13", "2026-11": "01JAN14" }))));
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<CspaCalculator employmentCategories={["EB1", "EB2", "EB3"]} familyCategories={["F2A"]} />);
    // Act
    fill("The child's date of birth", "2008-04-12");
    fill("Priority date", "2016-05-20");
    fill("The parent's I-140 receipt date", "2017-01-10");
    fill("Its approval date", "2017-06-30");
    // Assert: 21 on April 12 2029, plus 171 days pending.
    await screen.findByText("Under 21 if a visa is available by September 29, 2029");
    expect(String(fetchMock.mock.calls[0]![0])).toBe("/api/bulletin-line?set=employment&category=EB2&country=india");
    expect(screen.getByText("171 days")).toBeTruthy();
    expect(screen.getByText("January 1, 2014")).toBeTruthy();
  });

  it("offers the chart choice only for an I-485 filed before August 15, 2025", async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify(line({ "2025-07": "C" })))) as unknown as typeof fetch;
    render(<CspaCalculator employmentCategories={["EB2"]} familyCategories={[]} />);
    expect(screen.queryByLabelText("Chart USCIS named for filing")).toBeNull();
    fill("When the child filed (optional)", "2025-08-14");
    expect(screen.getByLabelText("Chart USCIS named for filing")).toBeTruthy();
    fill("When the child filed (optional)", "2025-08-15");
    expect(screen.queryByLabelText("Chart USCIS named for filing")).toBeNull();
  });

  it("says why when the line didn't load", async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify({ ok: false, message: "The bulletin archive couldn't be read just now." }), { status: 503 })) as unknown as typeof fetch;
    render(<CspaCalculator employmentCategories={["EB2"]} familyCategories={[]} />);
    fill("The child's date of birth", "2008-04-12");
    fill("Priority date", "2016-05-20");
    fill("The parent's I-140 receipt date", "2017-01-10");
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/didn.t load/));
    expect(screen.getByRole("button", { name: /try again/i })).toBeTruthy();
  });
});
