import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { CheckRow } from "@/lib/scorecard/checks";
import { EstimateChecksList } from "../EstimateChecksList";

const ROWS: CheckRow[] = [
  { key: "perm-line", estimate: "When DOL decides a PERM case", result: "3 days typically", basis: "10,119 cases on the first day" },
  { key: "pwd-day", estimate: "When DOL issues a wage determination", result: "1 day typically", basis: "9,911 requests" },
];

describe("EstimateChecksList", () => {
  it("keeps a row's last words apart from the next row's first, as text extractors read it", () => {
    const text = (render(<EstimateChecksList rows={ROWS} />).container.textContent ?? "").replace(/\s+/g, " ");
    expect(text).toContain("first day When DOL issues");
    expect(text).toContain("PERM case 3 days");
    expect(text).toContain("typically 10,119");
  });
});
