import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import type { ActivityDay } from "@/lib/activityStats";

import { DecisionPaceChart } from "../DecisionPaceChart";
import { OutcomeMix } from "../OutcomeMix";
import { WeekdayShape } from "../WeekdayShape";
import { outcomeByQuarter, weekdayProfile } from "@/lib/activityStats";

function run(start: string, count: number, total: number): ActivityDay[] {
  const out: ActivityDay[] = [];
  const d = new Date(`${start}T00:00:00Z`);
  for (let i = 0; i < count; i++) {
    out.push({
      date: d.toISOString().slice(0, 10),
      total,
      certified: Math.round(total * 0.93),
      denied: Math.round(total * 0.04),
      withdrawn: Math.round(total * 0.03),
    });
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

/** Mondays: 2026-06-22 and 2026-08-17, six empty weeks between them. */
const DISCLOSURE = run("2026-06-22", 21, 600);
const LIVE = run("2026-08-17", 7, 800);

describe("DecisionPaceChart", () => {
  it("breaks at a hole instead of drawing a line through it", () => {
    // The 43 days between the quarterly file ending and the live scan
    // starting are unmeasured. One polyline spanning them would draw six
    // weeks of trend that nobody recorded.
    const { container } = render(
      <DecisionPaceChart
        series={[
          { label: "Disclosure", color: "var(--primary)", days: DISCLOSURE },
          { label: "Live", color: "var(--stage-pwd)", days: LIVE },
        ]}
      />,
    );
    const marks = container.querySelectorAll("polyline, circle");
    expect(marks.length).toBe(2);
    // And the two runs really do sit apart on the shared axis rather than
    // being renumbered side by side.
    const poly = container.querySelector("polyline")!;
    const xs = (poly.getAttribute("points") ?? "")
      .split(" ")
      .map((p) => Number(p.split(",")[0]));
    const dotX = Number(container.querySelector("circle")!.getAttribute("cx"));
    expect(dotX).toBeGreaterThan(Math.max(...xs) + 100);
  });

  it("breaks a hole INSIDE one instrument, not only between two", () => {
    // The October 2025 shape: one series, 23 days missing from the middle of
    // it. Probed by making segments() never split, which this catches and the
    // two-series test above does not, because there the break came from the
    // series boundary rather than from the hole.
    const holed = [...run("2026-06-22", 14, 600), ...run("2026-08-17", 14, 600)];
    const { container } = render(
      <DecisionPaceChart
        series={[{ label: "Disclosure", color: "var(--primary)", days: holed }]}
      />,
    );
    expect(container.querySelectorAll("polyline, circle")).toHaveLength(2);
  });

  it("draws a single-week run as a point, since one week is not a line", () => {
    const { container } = render(
      <DecisionPaceChart
        series={[
          { label: "Disclosure", color: "var(--primary)", days: DISCLOSURE },
          { label: "Live", color: "var(--stage-pwd)", days: LIVE },
        ]}
      />,
    );
    expect(container.querySelectorAll("circle")).toHaveLength(1);
  });

  it("gives each instrument its own colour and names both", () => {
    // Two different instruments are two different meanings, so they get two
    // colours rather than two opacities of one.
    const { container } = render(
      <DecisionPaceChart
        series={[
          { label: "Disclosure corpus", color: "var(--primary)", days: DISCLOSURE },
          { label: "Live case scan", color: "var(--stage-pwd)", days: LIVE },
        ]}
      />,
    );
    expect(screen.getByText("Disclosure corpus")).toBeTruthy();
    expect(screen.getByText("Live case scan")).toBeTruthy();
    const colours = new Set(
      [...container.querySelectorAll("polyline, circle")].map(
        (el) => el.getAttribute("stroke") ?? el.getAttribute("fill"),
      ),
    );
    expect(colours.size).toBe(2);
  });

  it("says in its accessible name that the breaks are breaks", () => {
    render(
      <DecisionPaceChart
        series={[{ label: "Disclosure", color: "var(--primary)", days: DISCLOSURE }]}
      />,
    );
    expect(screen.getByRole("img").getAttribute("aria-label")).toMatch(/breaks/i);
  });

  it("renders nothing for an empty series", () => {
    const { container } = render(<DecisionPaceChart series={[]} />);
    expect(container.firstChild).toBeNull();
  });
});

describe("WeekdayShape", () => {
  it("claims weekend work never stops only when no weekend day is zero", () => {
    const days = [...run("2026-08-17", 5, 500), ...run("2026-08-22", 2, 90)];
    render(<WeekdayShape profile={weekdayProfile(days)} />);
    expect(screen.getByText(/none carries zero decisions/i)).toBeTruthy();
  });

  it("drops the claim as soon as one weekend day is zero", () => {
    const days = [
      ...run("2026-08-17", 5, 500),
      { date: "2026-08-22", total: 0, certified: 0, denied: 0, withdrawn: 0 },
      ...run("2026-08-23", 1, 90),
    ];
    render(<WeekdayShape profile={weekdayProfile(days)} />);
    expect(screen.queryByText(/none carries zero decisions/i)).toBeNull();
    expect(screen.getByText(/1 at zero/)).toBeTruthy();
  });

  it("marks the weekday and weekend rates apart", () => {
    const days = [...run("2026-08-17", 5, 500), ...run("2026-08-22", 2, 90)];
    render(<WeekdayShape profile={weekdayProfile(days)} />);
    expect(screen.getByText(/about 500 decisions and a weekend day about 90/i)).toBeTruthy();
  });
});

describe("OutcomeMix", () => {
  const quarters = outcomeByQuarter([
    ...run("2026-01-05", 30, 500),
    ...run("2026-04-06", 30, 400),
  ]);

  it("prints the certified share rather than drawing it", () => {
    // Certified runs 86% to 95%, so a stacked bar is one huge band and two
    // slivers, and the slivers carry the whole change.
    render(<OutcomeMix quarters={quarters} />);
    expect(screen.getAllByText(/93\.0% certified/).length).toBeGreaterThan(0);
  });

  it("gives denied and withdrawn separate colours and separate labels", () => {
    const { container } = render(<OutcomeMix quarters={quarters} />);
    expect(screen.getByText("Denied")).toBeTruthy();
    expect(screen.getByText(/Withdrawn by the employer/)).toBeTruthy();
    expect(container.querySelectorAll(".bg-data-bad").length).toBeGreaterThan(0);
    expect(container.querySelectorAll(".bg-data-warn").length).toBeGreaterThan(0);
  });

  it("carries each quarter's decided count", () => {
    render(<OutcomeMix quarters={quarters} />);
    expect(screen.getByText(/15,000 decided/)).toBeTruthy();
  });

  it("renders nothing without quarters", () => {
    const { container } = render(<OutcomeMix quarters={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
