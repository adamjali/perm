import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { DeadlineDocket, EXAMPLE_CASE, exampleDocket } from "../DeadlineDocket";
import { calculateI140FilingDeadline, calculatePWDExpiration } from "@/lib/perm";

const day = (iso: string) => new Date(`${iso}T00:00:00Z`);
const addDays = (iso: string, n: number) => new Date(day(iso).getTime() + n * 86_400_000).toISOString().slice(0, 10);

describe("the example docket", () => {
  it("runs Sunday ads on Sundays", () => {
    expect(day(EXAMPLE_CASE.sundayAdFirstDate).getUTCDay()).toBe(0);
    expect(day(EXAMPLE_CASE.sundayAdSecondDate).getUTCDay()).toBe(0);
  });

  it("lists the computed deadlines in date order", () => {
    const dates = exampleDocket().computed.map((r) => r.date);
    expect(dates).toEqual([...dates].sort());
  });

  it("opens the filing window 30 days after recruitment ends and closes it by day 180", () => {
    const d = exampleDocket();
    expect(d.window.opens).toBe(addDays(d.lastRecruitment, 30));
    expect(d.window.closes <= addDays(d.firstRecruitment, 180)).toBe(true);
    expect(d.window.closes <= calculatePWDExpiration(EXAMPLE_CASE.pwdDeterminationDate)).toBe(true);
  });

  it("dates the I-140 deadline by the central rule", () => {
    const d = exampleDocket();
    expect(d.certification.row.date).toBe(calculateI140FilingDeadline(EXAMPLE_CASE.certificationDate));
  });

  it("labels itself an example and cites a rule on every computed row", () => {
    render(<DeadlineDocket />);
    expect(screen.getByText("Example case")).toBeInTheDocument();
    // Every computed row plus the certification row carries one citation.
    expect(screen.getAllByText(/^20 CFR /)).toHaveLength(exampleDocket().computed.length + 1);
  });
});

describe("the attorney page", () => {
  const read = (f: string) => readFileSync(join(process.cwd(), f), "utf8");
  const page = read("src/app/(site)/(public)/for-attorneys/page.tsx");
  const hero = read("src/components/home/AttorneyHero.tsx");
  const tour = read("src/components/home/AttorneyTour.tsx");

  it("is the product at work, not an illustration", () => {
    expect(page).toMatch(/<AttorneyHero\b/);
    expect(hero).toMatch(/TOUR_SHOTS\.hub\b/);
    expect(page + hero).not.toMatch(/hero-showcase/);
  });

  it("works the example case out under the case form", () => {
    expect(page).toMatch(/<AttorneyTour\b/);
    expect(tour).toMatch(/<DeadlineDocket\b/);
  });
});
