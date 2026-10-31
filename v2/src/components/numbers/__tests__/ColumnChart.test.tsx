import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ColumnChart, type Column } from "../ColumnChart";

/** The printed label over a column (the screen-reader table prints the same figure too). */
const topLabel = (root: HTMLElement, text: string) =>
  [...root.querySelectorAll<HTMLElement>('span[aria-hidden="true"]')].find((el) => el.textContent?.trim() === text)!;

const cols: Column[] = [
  { key: "a", value: 13.5, label: "Q1", tip: "Q1", top: "13.5" },
  { key: "b", value: 0, label: "Q2", tip: "Q2 none held", gap: true },
  { key: "c", value: 13.2, label: "Q3", tip: "Q3", top: "13.2", now: true },
];

describe("the column chart's value labels", () => {
  it("prints every label at every width by default", () => {
    const { container } = render(<ColumnChart columns={cols} label="Medians" first="Q1" last="Q3" unit="months" showMax={false} />);
    for (const t of ["13.5", "13.2"]) expect(topLabel(container, t).className).not.toMatch(/\bhidden\b/);
  });

  it("holds crowded labels back until the width named, the readout still carrying each figure", () => {
    const { container } = render(
      <ColumnChart columns={cols} label="Medians" first="Q1" last="Q3" unit="months" showMax={false} topsFrom="xl" />,
    );
    for (const t of ["13.5", "13.2"]) expect(topLabel(container, t).className).toMatch(/\bhidden\b.*\bxl:block\b/);
    // The room above the columns opens at the same width, so a phone keeps no empty band.
    expect(container.innerHTML).toContain("xl:pt-7");
    expect(container.querySelector('[data-tip="Q1"]')).not.toBeNull();
  });

  it("draws a quarter nobody holds as an empty frame, never a zero column", () => {
    const { container } = render(<ColumnChart columns={cols} label="Medians" first="Q1" last="Q3" unit="months" showMax={false} />);
    expect(container.querySelector('[data-tip="Q2 none held"]')?.className).toMatch(/border-dashed/);
  });

  it("takes a shared scale, so two charts side by side compare", () => {
    const one: Column[] = [{ key: "m", value: 50, label: "Mar", tip: "Mar" }];
    const { container: own } = render(<ColumnChart columns={one} label="A" first="Mar" last="Mar" unit="LCAs" showMax={false} />);
    const { container: shared } = render(
      <ColumnChart columns={one} label="B" first="Mar" last="Mar" unit="LCAs" showMax={false} scaleMax={200} />,
    );
    expect((own.querySelector('[data-tip="Mar"]') as HTMLElement).style.height).toBe("100%");
    expect((shared.querySelector('[data-tip="Mar"]') as HTMLElement).style.height).toBe("25%");
  });
});

describe("the column chart's key", () => {
  it("names an empty column and one still filling, and only what the chart draws", () => {
    const partial: Column[] = [...cols, { key: "d", value: 5, label: "Q4", tip: "Q4 so far", partial: true }];
    const { getByRole, rerender, queryByRole } = render(
      <ColumnChart columns={partial} label="Medians" first="Q1" last="Q4" unit="months" gapKey="No reading that quarter" />,
    );
    const key = getByRole("list", { name: "Key" });
    expect(key.textContent).toContain("No reading that quarter");
    expect(key.textContent).toContain("Still filling");
    rerender(<ColumnChart columns={cols} label="Medians" first="Q1" last="Q3" unit="months" />);
    expect(getByRole("list", { name: "Key" }).textContent).not.toContain("Still filling");
    rerender(<ColumnChart columns={[cols[0]!, cols[2]!]} label="Medians" first="Q1" last="Q3" unit="months" />);
    expect(queryByRole("list", { name: "Key" })).toBeNull();
  });
});
