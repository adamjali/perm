// @vitest-environment jsdom
/**
 * The change browser's two honesty rules, and the filtering that hangs off
 * them.
 *
 * RULE ONE: A CONTROL THAT CANNOT WORK IS SHOWN, DISABLED, WITH ITS REASON.
 * DOL returns five fields on a live case - number, employer, job title, filing
 * date, status. Wage, law firm, worksite state and SOC arrive only when the
 * case is published in a quarterly file. Offering those as filters here would
 * return nothing and read as a broken site; omitting them leaves the reader
 * wondering. Both were rejected, so the test pins the third option.
 *
 * RULE TWO: A TRUNCATED LIST IS NOT SORTABLE. The prerendered slice is the
 * first rows of the day by employer. Sorting it by status would put a
 * confident-looking order over a sample, so every control stays off until the
 * whole day has arrived - which is also the state a reader with no JavaScript
 * keeps permanently, so the sentence beside the table has to be true then too.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";

import type { CaseChange, ChangeCalendar, ChangeDayFeed } from "@/lib/turso/changes";

const usePublicQuery = vi.fn();
vi.mock("@/lib/usePublicQuery", () => ({ usePublicQuery }));

const { ChangeFeedBrowser } = await import("../ChangeFeedBrowser");

/**
 * The two records as production holds them. The gap between 2026-06-30 and
 * 2026-08-26 is genuine, so a fixture using round numbers would not exercise
 * the case the page exists to describe.
 */
const WINDOWS = {
  decided: { from: "2023-10-01", to: "2026-06-30" },
  observed: { from: "2026-08-26", to: "2026-09-03" },
};

function change(over: Partial<CaseChange> = {}): CaseChange {
  return {
    caseNumber: "G-100-25308-370619",
    program: "perm",
    observedOn: "2026-09-03",
    fromStatus: "ANALYST REVIEW",
    toStatus: "CERTIFIED",
    isFinal: true,
    employerName: "Flextronics International USA, Inc.",
    jobTitle: "Automation Engineer",
    filingDate: "2025-11-04",
    ...over,
  };
}

const CALENDAR: ChangeCalendar = {
  days: [
    { date: "2026-09-03", total: 587, byProgram: { perm: 279, pwd: 200, lca: 108 } },
    { date: "2026-09-02", total: 1090, byProgram: { perm: 1090, pwd: 0, lca: 0 } },
  ],
  observedSince: "2026-08-27",
  programSince: { perm: "2026-08-27", pwd: "2026-09-03", lca: "2026-09-03" },
  truncated: false,
};

const ROWS: CaseChange[] = [
  change({ caseNumber: "G-100-25308-370619", employerName: "Flextronics International USA, Inc." }),
  change({
    caseNumber: "G-100-25200-111111",
    employerName: "Amazon.com Services LLC",
    jobTitle: "Software Development Engineer",
    toStatus: "DENIED",
  }),
  change({
    caseNumber: "P-100-26100-222222",
    program: "pwd",
    employerName: "Zebra Technologies",
    jobTitle: "Data Scientist",
    fromStatus: "IN PROCESS",
    toStatus: "DETERMINATION ISSUED",
    filingDate: "2026-04-09",
  }),
];

function day(over: Partial<ChangeDayFeed> = {}): ChangeDayFeed {
  return {
    date: "2026-09-03",
    changes: ROWS,
    total: 587,
    byProgram: { perm: 2, pwd: 1, lca: 0 },
    transitions: [
      { fromStatus: "ANALYST REVIEW", toStatus: "CERTIFIED", n: 175 },
      { fromStatus: "ANALYST REVIEW", toStatus: "DENIED", n: 29 },
      { fromStatus: "IN PROCESS", toStatus: "DETERMINATION ISSUED", n: 121 },
    ],
    expiriesExcluded: 287,
    bulkExcluded: 0,
    ...over,
  };
}

/** The state before the whole-day fetch lands, and with the script broken. */
function pending() {
  usePublicQuery.mockReturnValue({ data: undefined, failed: false });
}
/** The state once it has. */
function loaded(over: Partial<ChangeDayFeed> = {}) {
  usePublicQuery.mockReturnValue({ data: { day: day(over) }, failed: false });
}

function caseNumbers(): string[] {
  const table = screen.getByRole("table");
  return within(table)
    .getAllByRole("row")
    .slice(1)
    .map((r) => r.cells[0]!.textContent!.trim());
}

beforeEach(() => {
  usePublicQuery.mockReset();
});

describe("filters DOL's data cannot support", () => {
  it("explains them on a date only the live check covers, and opens itself", () => {
    // 2026-09-03 is past DOL's last published file, so on THIS date the four
    // fields genuinely do not exist and the explanation is what the reader
    // needs. The panel opens itself for exactly this case.
    loaded();
    render(<ChangeFeedBrowser calendar={CALENDAR} initialDay={day()} windows={WINDOWS} />);

    const panel = document.querySelector("details");
    expect(panel?.open).toBe(true);
    for (const why of [/no wage from the live case lookup/i, /attorney or agent only at publication/i,
                       /worksite is on the published record/i, /SOC code is on the published record/i]) {
      expect(screen.getByText(why)).toBeInTheDocument();
    }
  });

  it("says they WORK on a date inside the published files, and stays shut", () => {
    // THE OLD BEHAVIOUR WAS A BLANKET RULE AND IT WAS WRONG. These four exist
    // on every published case, so on a date DOL has published they are fully
    // filterable. Disabling them regardless taught the reader they can never
    // be used, which is what made a two-year-old date look unanswerable.
    loaded();
    render(
      <ChangeFeedBrowser
        calendar={CALENDAR}
        initialDay={{ ...day(), date: "2025-03-12" }}
        windows={WINDOWS}
      />,
    );

    const panel = document.querySelector("details");
    expect(panel?.open).toBe(false);
    expect(screen.getByText(/available for these dates/i)).toBeInTheDocument();
    expect(screen.queryByText(/no wage from the live case lookup/i)).toBeNull();
  });

  it("sends the reader where those filters do work", () => {
    loaded();
    render(<ChangeFeedBrowser calendar={CALENDAR} initialDay={day()} windows={WINDOWS} />);
    expect(screen.getByRole("link", { name: /decided case browser/i })).toHaveAttribute(
      "href",
      "/perm-cases",
    );
  });
});

describe("before the whole day has loaded", () => {
  it("turns every control off, including sorting", () => {
    pending();
    render(<ChangeFeedBrowser calendar={CALENDAR} initialDay={day()} windows={WINDOWS} />);

    expect((screen.getByLabelText("Search these dates") as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByLabelText("Changed from") as HTMLSelectElement).disabled).toBe(true);
    expect((screen.getByLabelText("Program") as HTMLSelectElement).disabled).toBe(true);
    for (const h of screen.getAllByRole("button", { name: /Employer|Changed to/ })) {
      expect((h as HTMLButtonElement).disabled).toBe(true);
    }
  });

  it("says what is on screen without promising a load that may never come", () => {
    // This is also the prerendered sentence, so it has to read correctly for
    // somebody whose JavaScript never runs.
    pending();
    render(<ChangeFeedBrowser calendar={CALENDAR} initialDay={day()} windows={WINDOWS} />);
    expect(screen.getByText(/Showing the first 3 of 587 changes/)).toBeTruthy();
  });

  it("still lets the day be changed, because that is a fresh request either way", () => {
    pending();
    render(<ChangeFeedBrowser calendar={CALENDAR} initialDay={day()} windows={WINDOWS} />);
    expect((screen.getByLabelText("From date") as HTMLInputElement).disabled).toBe(false);
  });
});

describe("searching, filtering and sorting one day", () => {
  it("searches the case number, the employer and the job title", () => {
    loaded();
    render(<ChangeFeedBrowser calendar={CALENDAR} initialDay={day()} windows={WINDOWS} />);
    const box = screen.getByLabelText("Search these dates");

    fireEvent.change(box, { target: { value: "flextronics" } });
    expect(caseNumbers()).toEqual(["G-100-25308-370619"]);

    fireEvent.change(box, { target: { value: "Data Scientist" } });
    expect(caseNumbers()).toEqual(["P-100-26100-222222"]);

    fireEvent.change(box, { target: { value: "25200" } });
    expect(caseNumbers()).toEqual(["G-100-25200-111111"]);
  });

  it("filters on each end of the transition independently", () => {
    // A count cannot show a transition, and neither can one end of it:
    // "everything that became CERTIFIED" and "everything that left ANALYST
    // REVIEW" are different questions.
    loaded();
    render(<ChangeFeedBrowser calendar={CALENDAR} initialDay={day()} windows={WINDOWS} />);

    fireEvent.change(screen.getByLabelText("Changed to"), { target: { value: "DENIED" } });
    expect(caseNumbers()).toEqual(["G-100-25200-111111"]);

    fireEvent.change(screen.getByLabelText("Changed to"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Changed from"), { target: { value: "IN PROCESS" } });
    expect(caseNumbers()).toEqual(["P-100-26100-222222"]);
  });

  it("filters by program, and disables a program with nothing that day", () => {
    loaded();
    render(<ChangeFeedBrowser calendar={CALENDAR} initialDay={day()} windows={WINDOWS} />);
    const select = screen.getByLabelText("Program") as HTMLSelectElement;

    fireEvent.change(select, { target: { value: "pwd" } });
    expect(caseNumbers()).toEqual(["P-100-26100-222222"]);

    // Shown with its count rather than hidden: a program with nothing on this
    // day is a fact about the day, and hiding it reads as the program not
    // existing at all.
    const lca = within(select).getByRole("option", { name: /H-1B LCA/ }) as HTMLOptionElement;
    expect(lca.disabled).toBe(true);
    expect(lca.textContent).toContain("(0)");
  });

  it("sorts on any column, and a click on the active one reverses it", () => {
    loaded();
    render(<ChangeFeedBrowser calendar={CALENDAR} initialDay={day()} windows={WINDOWS} />);

    // Employer ascending is the default, and it is already active, so the
    // first click on that header flips it rather than re-applying it.
    expect(caseNumbers()[0]).toBe("G-100-25200-111111"); // Amazon
    fireEvent.click(screen.getByRole("button", { name: /^Employer/ }));
    expect(caseNumbers()[0]).toBe("P-100-26100-222222"); // Zebra
    fireEvent.click(screen.getByRole("button", { name: /^Employer/ }));
    expect(caseNumbers()[0]).toBe("G-100-25200-111111");

    // A different column starts in the direction that column is read in: a
    // date newest-first, a name A to Z.
    fireEvent.click(screen.getByRole("button", { name: /^Filed/ }));
    expect(caseNumbers()[0]).toBe("P-100-26100-222222"); // 2026-04-09
    fireEvent.click(screen.getByRole("button", { name: /^Changed to/ }));
    expect(caseNumbers()[0]).toBe("G-100-25308-370619"); // CERTIFIED
  });

  it("reports how many matched, and offers a way back when nothing does", () => {
    loaded();
    render(<ChangeFeedBrowser calendar={CALENDAR} initialDay={day()} windows={WINDOWS} />);

    fireEvent.change(screen.getByLabelText("Search these dates"), {
      target: { value: "no such employer" },
    });
    expect(screen.queryByRole("table")).toBeNull();
    // The empty state names the day's real size, so "no results" cannot be
    // mistaken for "DOL did nothing".
    const empty = screen.getByText(/Nothing on .* matches that/);
    expect(empty.textContent).toContain("587");

    fireEvent.click(screen.getByRole("button", { name: /Clear filters/i }));
    expect(caseNumbers()).toHaveLength(3);
  });
});

describe("what the day itself leaves out", () => {
  it("names both exclusions, with the count each one costs THAT day", () => {
    // Rendered on the server once, this would keep describing the day the page
    // was built for while the reader looked at another one.
    loaded({ expiriesExcluded: 92_113, bulkExcluded: 2_410 });
    render(<ChangeFeedBrowser calendar={CALENDAR} initialDay={day()} windows={WINDOWS} />);

    const note = screen.getByText(/Left out of that count/);
    expect(note.textContent).toContain("92,113");
    expect(note.textContent).toContain("2,410");
    expect(note.textContent).toMatch(/180-day/);
    expect(note.textContent).toMatch(/catching up/);
  });

  it("says nothing when a day excluded nothing, rather than printing a zero", () => {
    loaded({ expiriesExcluded: 0, bulkExcluded: 0 });
    render(<ChangeFeedBrowser calendar={CALENDAR} initialDay={day()} windows={WINDOWS} />);
    expect(screen.queryByText(/Left out of that count/)).toBeNull();
  });
});
