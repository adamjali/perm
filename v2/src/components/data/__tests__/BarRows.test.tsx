import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BarRows, StackedBar, barRowTip, type BarRow } from "../BarRows";

/**
 * Every page that draws BarRows or a StackedBar gets hover detail from the
 * row itself, so the tests pin what a row says without any caller's help.
 */

const ROWS: BarRow[] = [
  { key: "a", label: "I-140 immigrant petition", sub: "4,210 pending, 3,900 decided in the quarter", value: 6.2, text: "6.2 mo" },
  { key: "b", label: <span translate="no">Acme Corp</span>, value: 41, text: "41 days" },
  { key: "c", label: "Newark, NJ", value: null, text: "" },
];

describe("BarRows tooltips", () => {
  it("derives the tip from the label, the figure and the sub-line", () => {
    expect(barRowTip(ROWS[0]!)).toBe("I-140 immigrant petition\n6.2 mo\n4,210 pending, 3,900 decided in the quarter");
  });

  it("reads the words out of a label that is markup, not a string", () => {
    expect(barRowTip(ROWS[1]!)).toBe("Acme Corp\n41 days");
  });

  it("says withheld for a null value rather than an empty figure", () => {
    expect(barRowTip(ROWS[2]!)).toBe("Newark, NJ\nwithheld");
  });

  it("lets a caller say more than the row prints", () => {
    expect(barRowTip({ ...ROWS[0]!, tip: "Custom\n1 line" })).toBe("Custom\n1 line");
  });

  it("puts the tip on each row and shows it on hover", () => {
    const { container } = render(<BarRows label="Median months" rows={ROWS} />);
    const marks = container.querySelectorAll("[data-tip]");
    expect(marks).toHaveLength(3);
    fireEvent.pointerMove(marks[0]!, { pointerType: "mouse" });
    expect(container.querySelector(".chart-tip")?.textContent).toContain("6.2 mo");
  });
});

describe("StackedBar tooltips", () => {
  it("gives each segment its count and its share of the whole bar", () => {
    const { container } = render(
      <StackedBar
        label="EB-2 by country"
        total={200}
        segments={[
          { key: "in", label: "India", value: 150 },
          { key: "cn", label: "China", value: 50 },
        ]}
      />,
    );
    const tips = [...container.querySelectorAll("[data-tip]")].map((el) => el.getAttribute("data-tip"));
    expect(tips).toEqual(["India\n150\n75% of 200 in all", "China\n50\n25% of 200 in all"]);
  });
});
