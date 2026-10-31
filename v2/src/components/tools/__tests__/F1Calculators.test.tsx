import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CapGapPart, OptDaysPart } from "../CapGapCalculator";
import { PendingExtensionCalculator } from "../PendingExtensionCalculator";

/** The cap-gap, OPT days and 240-day calculators draw what the rules in f1Dates say, and say when an input defeats them. */

const fill = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe("the cap-gap part", () => {
  it("runs to April 1 of the fiscal year while pending, and to the approved start once approved", () => {
    render(<CapGapPart />);
    fill("OPT ends", "2027-05-31");
    fill("H-1B start asked for", "2027-10-01");
    fill("H-1B petition filed", "2027-04-01");
    expect(document.body.textContent).toMatch(/fiscal year 2028 cap, the extension runs until April 1, 2028 while the petition is pending/);
    fill("Approved start (optional)", "2027-10-01");
    expect(document.body.textContent).toMatch(/runs until October 1, 2027, the approved petition's start date/);
  });

  it("says there's no OPT to extend when it ended before the filing", () => {
    render(<CapGapPart />);
    fill("OPT ends", "2027-03-01");
    fill("H-1B start asked for", "2027-10-01");
    fill("H-1B petition filed", "2027-04-01");
    expect(screen.getByText(/The OPT had ended by the day the petition was filed/)).toBeTruthy();
  });
});

describe("the OPT days part", () => {
  it("counts the days used and names day 90", () => {
    render(<OptDaysPart />);
    fill("Days without work so far", "88");
    expect(screen.getByText("88 of 90")).toBeTruthy();
    fill("STEM extension granted", "yes");
    expect(screen.getByText("88 of 150")).toBeTruthy();
  });

  it("refuses an impossible count", () => {
    render(<OptDaysPart />);
    fill("Days without work so far", "-3");
    expect(screen.getByText(/whole number from 0 to 400/)).toBeTruthy();
  });
});

describe("the 240-day calculator", () => {
  it("names day 240 both ways, and says when the extension came too late", () => {
    render(<PendingExtensionCalculator />);
    fill("I-94 end date", "2026-01-01");
    fill("Extension filed", "2025-12-15");
    expect(document.body.textContent).toMatch(/day 240 is August 28, 2026\. Counted from the next day it's August 29, 2026\./);
    expect(screen.queryByText(/filed after the stay ended/)).toBeNull();
    fill("Extension filed", "2026-01-05");
    expect(screen.getByText(/filed after the stay ended/)).toBeTruthy();
  });
});
