import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatusRibbon, ribbonTip, type RibbonParts } from "../StatusRibbon";

const PARTS: RibbonParts = { pending: 218, held: 216, otherReview: 0, appeal: 0, queue: 2 };

describe("StatusRibbon tooltips", () => {
  it("says who acted and out of how many, under the employer's name", () => {
    expect(ribbonTip(PARTS, "review", "Adobe Inc.")).toBe("Adobe Inc.\n216 on hold\nOf 218 pending");
    expect(ribbonTip(PARTS, "queue")).toBe("Pending PERM cases\n2 in DOL's normal queue\nOf 218 pending");
  });

  it("puts a tip on each drawn segment only", () => {
    const { container } = render(<StatusRibbon parts={PARTS} label="216 on hold; 2 in DOL's normal queue" name="Adobe Inc." />);
    expect(container.querySelectorAll("[data-tip]")).toHaveLength(2);
  });
});
