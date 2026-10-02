import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FieldPosition } from "../FieldPosition";

/** Each histogram bar says roughly where it sits, how many it holds, and whether the subject is in it. */
describe("FieldPosition tooltips", () => {
  const population = [100, 110, 120, 130, 140, 150, 160, 170, 180, 380];

  it("gives every bar its count against the whole field, and marks the subject's bar", () => {
    const { container } = render(
      <FieldPosition population={population} value={380} valueLabel="380 days" measure="Median days to decision" />,
    );
    const tips = [...container.querySelectorAll("[data-tip]")].map((el) => el.getAttribute("data-tip") ?? "");
    expect(tips).toHaveLength(28);
    expect(tips.every((t) => /^Around \d+\n\d+ of 10 in the field/.test(t))).toBe(true);
    expect(tips.filter((t) => t.includes("This one: 380 days"))).toHaveLength(1);
    expect(tips[27]).toContain("1 of 10 in the field");
    expect(container.querySelector("[title]")).toBeNull();
  });
});
