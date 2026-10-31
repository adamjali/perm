import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { CatchingUp } from "../CatchingUp";
import { PwdDateEstimate } from "../PwdDateEstimate";
import type { PwdDayData } from "@/lib/pwdDay";

// The estimate reads today; pin it (Saturday Oct 31 2026, midday Eastern).
beforeAll(() => {
  vi.useFakeTimers({ now: new Date("2026-10-31T16:00:00Z"), toFake: ["Date"] });
});
afterAll(() => {
  vi.useRealTimers();
});

const DATA: PwdDayData = {
  queue: {
    asOf: "2026-10-31",
    byDay: [
      ["2026-07-27", 336],
      ["2026-07-28", 717],
      ["2026-08-03", 780],
      ["2026-08-14", 760],
    ],
    pace: { perWorkday: 700, fast: 775, slow: 669, workdaysUsed: 19 },
  },
  tested: null,
  measuredRange: [],
};

describe("PwdDateEstimate", () => {
  it("shows the ruler's empty state until a day is picked", () => {
    render(<PwdDateEstimate data={DATA} lineDay="2026-07-27" />);
    expect(screen.getAllByText("Pick the day it was filed").length).toBeGreaterThan(0);
    expect(screen.queryByText(/^Around /)).toBeNull();
  });

  it("dates a request filed after the day DOL is on, with the requests ahead", () => {
    render(<PwdDateEstimate data={DATA} lineDay="2026-07-27" />);
    fireEvent.change(screen.getByLabelText("The day the wage request was filed"), { target: { value: "2026-08-14" } });
    expect(screen.getByText(/^Around /)).toBeTruthy();
    // 336 + 717 + 780 ahead, and half of the same day's 760.
    expect(screen.getByText(/2,213 requests filed before it are still waiting/)).toBeTruthy();
  });

  it("says any day now for a request filed on or before the day DOL is deciding", () => {
    render(<PwdDateEstimate data={DATA} lineDay="2026-07-27" />);
    fireEvent.change(screen.getByLabelText("The day the wage request was filed"), { target: { value: "2026-07-20" } });
    expect(screen.getByText("Any day now")).toBeTruthy();
  });

  it("says how many of that day's requests are decided", () => {
    render(<PwdDateEstimate data={DATA} lineDay="2026-07-27" filedByDay={[["2026-08-14", 800]]} />);
    fireEvent.change(screen.getByLabelText("The day the wage request was filed"), { target: { value: "2026-08-14" } });
    expect(screen.getByText("40 of the 800 requests filed that day are decided.")).toBeTruthy();
  });

  it("refuses a day that hasn't come", () => {
    render(<PwdDateEstimate data={DATA} lineDay="2026-07-27" />);
    fireEvent.change(screen.getByLabelText("The day the wage request was filed"), { target: { value: "2026-12-01" } });
    expect(screen.getByText(/hasn.t come yet/)).toBeTruthy();
  });
});

describe("CatchingUp", () => {
  const day = { from: "2026-10-30", to: "2026-10-30", out: 339, issued: 334, withdrawn: 4, filed: 663 };
  const week = { from: "2026-10-24", to: "2026-10-30", out: 3277, issued: null, withdrawn: null, filed: 3041 };

  it("opens on the week, the fairer read", () => {
    render(<CatchingUp day={day} week={week} noun="requests" />);
    expect(screen.getByRole("button", { name: "Week" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("Gaining ground: 236 more left the line than joined it")).toBeTruthy();
  });

  it("switches to the day, and says a Friday runs light", () => {
    render(<CatchingUp day={day} week={week} noun="requests" />);
    fireEvent.click(screen.getByRole("button", { name: "Day" }));
    expect(screen.getByText(/Losing ground: 324 more joined/)).toBeTruthy();
    expect(screen.getByText(/about half as many on a Friday/)).toBeTruthy();
    expect(screen.getByText("DOL issued 334; employers withdrew 4.")).toBeTruthy();
  });
});
