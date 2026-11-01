import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FilingsSearch } from "../FilingsSearch";
import type { FacetRow } from "@/lib/db/entityDetail";

const row = (key: string | null, label: string, n: number, code: string | null = null): FacetRow => ({
  key, label, code, n, certified: n, denied: 0,
});
const JOBS = [row("software-developers", "Software Developers", 4310, "15-1252.00"), row("data-scientists", "Data Scientists", 328, "15-2051.00")];
const STATES = [row("WA", "Washington", 4475), row("CA", "California", 208), row(null, "Unknown", 3)];

describe("FilingsSearch", () => {
  it("on an employer's page, sends the employer along and narrows by title, job and state", () => {
    render(<FilingsSearch subject="Microsoft Corporation's" fixed={{ q: "Microsoft Corporation" }} ask="title" jobs={JOBS} states={STATES} />);
    const form = screen.getByRole("search", { name: "Search Microsoft Corporation's filings" });
    expect(form.getAttribute("action")).toBe("/case-search");
    expect(form.getAttribute("method")).toBe("get");
    expect(form.querySelector('input[type="hidden"][name="q"]')?.getAttribute("value")).toBe("Microsoft Corporation");
    expect(within(form).getByLabelText(/Job title/).getAttribute("name")).toBe("title");
    const job = within(form).getByLabelText(/Job \(SOC\)/) as HTMLSelectElement;
    expect([...job.options].map((o) => o.value)).toEqual(["", "software-developers", "data-scientists"]);
    // Only real two-letter states.
    const state = within(form).getByLabelText(/State/) as HTMLSelectElement;
    expect([...state.options].map((o) => o.value)).toEqual(["", "WA", "CA"]);
  });

  it("puts the employer's own jobs one tap away, each opening that employer's filings for it", () => {
    render(<FilingsSearch subject="Microsoft Corporation's" fixed={{ q: "Microsoft Corporation" }} ask="title" jobs={JOBS} />);
    const chip = screen.getByRole("link", { name: /Software Developers/ });
    expect(chip.getAttribute("href")).toBe("/case-search?q=Microsoft+Corporation&occupation=software-developers");
    expect(chip.textContent).toContain("4,310");
  });

  it("on a job's page, asks for an employer, offers no job picker, and its chips are the employers filing it", () => {
    const employers = [row("microsoft-corporation", "Microsoft Corporation", 4310)];
    render(<FilingsSearch subject="Software Developers" fixed={{ occupation: "software-developers" }} ask="q" employers={employers} />);
    const form = screen.getByRole("search");
    expect(form.querySelector('input[type="hidden"][name="occupation"]')?.getAttribute("value")).toBe("software-developers");
    expect(within(form).getByLabelText(/Employer/).getAttribute("name")).toBe("q");
    expect(within(form).queryByLabelText(/Job \(SOC\)/)).toBeNull();
    expect(screen.getByRole("link", { name: /Microsoft Corporation/ }).getAttribute("href")).toBe(
      "/case-search?occupation=software-developers&q=Microsoft+Corporation",
    );
  });
});
