import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ChartHit, hitSpan } from "../ChartHit";
import { ChartTips } from "../ChartTips";

/**
 * The SVG hover column: a full-height target a pointer can actually hit, and a
 * ring (or the bar it wraps) that takes the active outline. The column itself
 * must never take that outline, or every active point draws a tall box.
 */
describe("ChartHit", () => {
  function chart() {
    return render(
      <ChartTips label="Weeks">
        <svg viewBox="0 0 100 50">
          <ChartHit tip={"Week 1\n10 decided"} x={0} width={50} y={0} height={50} cx={25} cy={40} />
          <ChartHit tip={"Week 2\n20 decided"} x={50} width={50} y={0} height={50}>
            <rect data-testid="bar" x={55} y={20} width={40} height={30} />
          </ChartHit>
        </svg>
      </ChartTips>,
    );
  }

  it("carries the tip on a group, with a stroke-free column and the mark inside it", () => {
    const { container } = chart();
    const groups = container.querySelectorAll("g[data-tip]");
    expect(groups).toHaveLength(2);
    const column = groups[0]!.querySelector('rect[fill="transparent"]')!;
    expect(column.getAttribute("stroke")).toBe("none");
    expect(column.getAttribute("height")).toBe("50");
    expect(groups[0]!.querySelector("circle")?.getAttribute("cx")).toBe("25");
    expect(groups[1]!.querySelector('[data-testid="bar"]')).not.toBeNull();
  });

  it("shows its point's figures when the pointer is anywhere in the column", () => {
    const { container } = chart();
    const column = container.querySelectorAll('rect[fill="transparent"]')[1]!;
    fireEvent.pointerMove(column, { pointerType: "mouse" });
    expect(container.querySelector(".chart-tip")?.textContent).toBe("Week 220 decided");
  });

  it("spans halfway to each neighbour and stops at the plot's edges", () => {
    const x = (i: number) => 10 + i * 20; // 10, 30, 50
    expect(hitSpan(0, 3, x, 0, 60)).toEqual({ x: 0, width: 20 });
    expect(hitSpan(1, 3, x, 0, 60)).toEqual({ x: 20, width: 20 });
    expect(hitSpan(2, 3, x, 0, 60)).toEqual({ x: 40, width: 20 });
  });
});
