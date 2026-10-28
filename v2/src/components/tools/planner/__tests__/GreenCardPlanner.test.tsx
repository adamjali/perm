import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PlanReading } from "@/lib/db/planFigures";
import type { PlanAnswer } from "@/lib/planQuery";

import { GreenCardPlanner } from "../GreenCardPlanner";

const nav = vi.hoisted(() => ({ params: new URLSearchParams(), replace: vi.fn() }));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useRouter: () => ({ replace: nav.replace, push: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/tools/green-card-timeline",
  useSearchParams: () => nav.params,
}));

const TODAY = "2026-10-28";
const READING: PlanReading = {
  figures: {
    spans: {
      pwd: { low: 90, mid: 97, high: 110 },
      recruitment: { low: 73, mid: 120, high: 176 },
      perm: { low: 280, mid: 290, high: 300 },
      i140Prep: { low: 30, mid: 30, high: 30 },
      i140: { EB2: { low: 91, mid: 119, high: 119 }, EB3: { low: 119, mid: 122, high: 122 } },
      i485: { low: 180, mid: 183, high: 200 },
      ead: { low: 170, mid: 195, high: 230 },
      ap: { low: 160, mid: 177, high: 260 },
      consular: { low: 90, mid: 159, high: 255 },
    },
    nvcCreation: { low: 7, mid: 9, high: 14 },
    pace: {
      // 180 days of cutoff movement over 12 months: 15 days a month.
      "EB2|worldwide": { latest: { kind: "date", iso: "2025-04-01" }, movedDays: 180, spanMonths: 12, retrogressions: [] },
      "EB2|india": { latest: { kind: "unavailable" }, movedDays: null, spanMonths: null, retrogressions: [] },
    },
    bulletinMonth: "2026-11",
  },
  standing: { perm: "Now: DOL is deciding PERM cases filed around Jan 9, 2026" },
  sources: { perm: "The filing days DOL decided on its last working day" },
};
const ANSWER: PlanAnswer = {
  pwd: null,
  perm: { low: "2026-12-01", mid: "2026-12-20", high: "2027-01-15", casesAhead: 18000, perDay: 625 },
  permNote: null,
  line: { peopleAhead: { low: 20000, mid: 30000, high: 40000 }, perYear: 40000, fy: 2024 },
};
/** The debounce before the queues are asked, plus room. */
const ASKED = { timeout: 2000 };

const renderPlanner = () => render(<GreenCardPlanner reading={READING} check={null} today={TODAY} />);
const tile = (label: string) => within(screen.getByRole("list", { name: "Your dates" })).getByText(label).closest("li")!;
const row = (step: string) => screen.getByRole("link", { name: new RegExp(`^${step}$`) }).closest("li")!;
/** A step's figures, inside the "Change the figures" fold. */
const figures = (step: string) =>
  screen.getAllByText(step, { selector: "p" }).find((el) => el.closest("#figures"))!.closest("li")!;

const answering = (a: PlanAnswer) =>
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(a), { status: 200, headers: { "content-type": "application/json" } })),
  );

beforeEach(() => {
  nav.params = new URLSearchParams();
  nav.replace.mockClear();
  // A test that gives a past priority date asks for its line; none reaches the network.
  answering({ pwd: null, perm: null, permNote: null, line: null });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GreenCardPlanner", () => {
  it("plans from today with no address, every step dated as a range", () => {
    renderPlanner();
    // The answer first: when, how long, what it costs.
    const glance = screen.getByRole("region", { name: "Your plan at a glance" });
    expect(within(glance).getByText("Green card")).toBeInTheDocument();
    expect(within(glance).getByText("$3,645")).toBeInTheDocument();
    for (const step of ["Wage request", "Recruitment", "PERM", "Preparing the I-140", "I-140", "Visa bulletin", "I-485 and the green card"]) {
      expect(row(step)).toBeInTheDocument();
    }
    // Today, then 97 days for the wage request and 120 for recruitment: Jun 2027.
    expect(within(tile("Priority date")).getByText("Jun 2027")).toBeInTheDocument();
    expect(within(tile("Priority date")).getByText(/ to /)).toBeInTheDocument();
    expect(within(tile("Green card")).getByText(/^[A-Z][a-z]{2} 20\d\d$/)).toBeInTheDocument();
    expect(within(figures("PERM")).getByText("Now: DOL is deciding PERM cases filed around Jan 9, 2026")).toBeInTheDocument();
  });

  it("opens a link from the case page on the same dates, the old keys included", () => {
    nav.params = new URLSearchParams("where=perm-certified&date=2026-09-01&pd=2025-10-20");
    renderPlanner();
    expect(within(tile("PERM certified")).getByText("Sep 1, 2026")).toBeInTheDocument();
    expect(within(tile("PERM certified")).getByText("Your date")).toBeInTheDocument();
    expect(within(tile("Priority date")).getByText("Oct 20, 2025")).toBeInTheDocument();
    // The whole journey: the steps before the first date are there, done, dated back from it.
    expect(within(row("Wage request")).getByText(/^Done, about /)).toBeInTheDocument();
    expect(within(row("PERM")).getByText("Done Sep 1, 2026")).toBeInTheDocument();
  });

  it("writes a changed input back to the address without scrolling", () => {
    nav.params = new URLSearchParams("where=perm-filed");
    renderPlanner();
    fireEvent.change(screen.getByLabelText("PERM filed (your priority date)"), { target: { value: "2026-02-01" } });
    expect(nav.replace).toHaveBeenLastCalledWith("/tools/green-card-timeline?where=perm-filed&pd=2026-02-01", { scroll: false });
    fireEvent.change(screen.getByLabelText("Country of birth"), { target: { value: "india" } });
    expect(nav.replace).toHaveBeenLastCalledWith("/tools/green-card-timeline?where=perm-filed&country=india", { scroll: false });
  });

  it("says why there's no green card date when the line is unavailable", () => {
    nav.params = new URLSearchParams("country=india");
    renderPlanner();
    expect(within(tile("Green card")).getByText("No date yet")).toBeInTheDocument();
    expect(within(tile("Green card")).getByText("Unavailable in the November 2026 bulletin")).toBeInTheDocument();
    expect(screen.getByText(/EB-2, India is unavailable in the November 2026 bulletin/)).toBeInTheDocument();
  });

  it("takes the reader's own length for a step, and puts today's figures back", () => {
    renderPlanner();
    const typical = within(figures("PERM")).getByLabelText("Typical, days");
    expect(typical).toHaveValue(290);
    expect(within(tile("PERM certified")).getByText("Mar 2028")).toBeInTheDocument();
    fireEvent.change(typical, { target: { value: "500" } });
    expect(within(tile("PERM certified")).getByText("Oct 2028")).toBeInTheDocument();
    // The typed number stays typical; the slow end moves up to it.
    expect(typical).toHaveValue(500);
    expect(within(figures("PERM")).getByLabelText("Slow, days")).toHaveValue(500);
    expect(screen.getByText("1 changed")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Back to today's figures/ }));
    expect(within(tile("PERM certified")).getByText("Mar 2028")).toBeInTheDocument();
    expect(screen.queryByText("1 changed")).not.toBeInTheDocument();
  });

  it("reads a USCIS step in months", () => {
    renderPlanner();
    expect(within(figures("I-140")).getByLabelText("Typical, months")).toHaveValue(3.9);
  });

  it("refuses dates that can't go together, naming both, and draws no plan", () => {
    nav.params = new URLSearchParams("where=perm-certified&pd=2026-05-01&cert=2026-04-01");
    renderPlanner();
    expect(screen.getByRole("alert")).toHaveTextContent("PERM certified (Apr 1, 2026) is before PERM filed (May 1, 2026).");
    expect(screen.queryByRole("list", { name: "Your dates" })).not.toBeInTheDocument();
  });
});

describe("GreenCardPlanner, a filed PERM", () => {
  beforeEach(() => {
    nav.params = new URLSearchParams("where=perm-filed&pd=2026-02-10");
    answering(ANSWER);
  });

  it("asks the queues once, for the PERM and its line", async () => {
    renderPlanner();
    await screen.findByText("Dec 20, 2026", {}, ASKED);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(vi.mocked(fetch).mock.calls[0]![0]).toBe("/api/plan?perm=2026-02-10&pd=2026-02-10&cat=EB2&country=worldwide");
  });

  it("dates the decision from the cases ahead of it, with DOL's plain wait as the other choice", async () => {
    renderPlanner();
    expect(await within(tile("PERM certified")).findByText("Dec 20, 2026", {}, ASKED)).toBeInTheDocument();
    expect(within(figures("PERM")).getByText(/18,000 ahead of yours at 625 a day/)).toBeInTheDocument();
    // The plain wait: Feb 10 2026 + 290 days.
    fireEvent.click(within(figures("PERM")).getByLabelText(/DOL's wait now/));
    expect(within(tile("PERM certified")).getByText("Nov 27, 2026")).toBeInTheDocument();
  });

  it("dates when the priority date becomes current both ways, and switches the plan in one press", async () => {
    renderPlanner();
    const supply = await screen.findByRole("button", { name: /By the people ahead of you/ }, ASKED);
    const pace = screen.getByRole("button", { name: /At the cutoff's pace/ });
    expect(pace).toHaveAttribute("aria-pressed", "true");
    // Nov 1 2026 + 21 months by the pace (315 days behind the cutoff at 15 a month); + 9 by the people ahead (30,000 at 40,000 a year).
    expect(within(pace).getByText("Aug 2028")).toBeInTheDocument();
    expect(within(supply).getByText("Aug 2027")).toBeInTheDocument();
    expect(within(row("Visa bulletin")).getByText(/^Current around /)).toBeInTheDocument();
    const before = within(tile("I-485 filed")).getAllByText(/20\d\d/)[0]!.textContent;
    fireEvent.click(supply);
    expect(supply).toHaveAttribute("aria-pressed", "true");
    expect(within(tile("I-485 filed")).getAllByText(/20\d\d/)[0]!.textContent).not.toBe(before);
    fireEvent.change(screen.getByLabelText("Green cards to the line a year"), { target: { value: "20000" } });
    // 30,000 at 20,000 a year: 18 months.
    expect(within(supply).getByText("May 2028")).toBeInTheDocument();
  });
});

describe("GreenCardPlanner, the costs", () => {
  it("adds the reader's own costs to the government's fees, the PERM's for the employer", () => {
    renderPlanner();
    // I-140 on paper, the asylum program fee, the I-485, a work permit and a travel document.
    expect(screen.getAllByText("$3,645").length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText("Attorney for the PERM"), { target: { value: "4000" } });
    expect(screen.getAllByText("$7,645").length).toBeGreaterThan(0);
    const employer = screen.getByText("Employer pays", { selector: "dt" }).closest("div")!;
    expect(within(employer).getByText("$4,000")).toBeInTheDocument();
  });
  it("plans a green card through a consulate: NVC's steps and State's fee, no I-485 or work permit", () => {
    nav.params = new URLSearchParams("where=perm-filed&pd=2024-01-10");
    renderPlanner();
    expect(row("I-485 and the green card")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /At a US consulate abroad/ }));
    // The choice lands in the address, and the plan follows it.
    expect(nav.replace).toHaveBeenLastCalledWith(expect.stringContaining("route=cp"), expect.anything());
  });

  it("reads a consular plan from its address", () => {
    nav.params = new URLSearchParams("where=perm-filed&pd=2024-01-10&route=cp");
    renderPlanner();
    expect(row("NVC and the consulate")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^I-485 and the green card$/ })).toBeNull();
    expect(within(screen.getByRole("list", { name: "Your dates" })).getByText("Immigrant visa")).toBeInTheDocument();
    const costs = screen.getByRole("list", { name: "Each cost, in the order it falls due" });
    expect(within(costs).getByText("DS-260")).toBeInTheDocument();
    expect(within(costs).queryByText("I-485")).toBeNull();
    expect(screen.queryByLabelText("Work permit and travel document")).toBeNull();
  });

  it("puts the employer's size beside the total, where its fee changes it", () => {
    renderPlanner();
    const glance = screen.getByRole("region", { name: "Your plan at a glance" });
    expect(within(glance).getByText("$3,645")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("The employer"), { target: { value: "small" } });
    expect(within(glance).getByText("$3,345")).toBeInTheDocument();
  });
});
