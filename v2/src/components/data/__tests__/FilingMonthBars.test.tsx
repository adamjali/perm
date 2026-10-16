import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FilingMonthBars } from "../FilingMonthBars";

const months = [
  { month: "2026-05", total: 100, pending: 0 },
  { month: "2026-06", total: 120, pending: 30 },
  { month: "2026-07", total: 110, pending: 110 },
];

describe("FilingMonthBars", () => {
  it("draws decided in the brand green and still waiting in soft yellow, never black", () => {
    const { container } = render(<FilingMonthBars months={months} nouns="LCAs" label="LCAs by filing month" />);
    const cols = [...container.querySelectorAll<HTMLElement>("[data-tip]")];
    expect(cols).toHaveLength(3);
    // A month with some still waiting: a yellow cap over a green body.
    const mixed = cols[1]!;
    expect(mixed.children[0]!.className).toContain("bg-soft-wait");
    expect(mixed.children[1]!.className).toContain("bg-primary");
    expect(container.innerHTML).not.toContain("bg-foreground");
  });
});
