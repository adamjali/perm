import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { IndexHeader } from "@/components/data/IndexHeader";

describe("IndexHeader", () => {
  it("draws a figure's direction chip only when it has one", () => {
    render(
      <IndexHeader
        title="Find a prevailing wage request"
        lede="Search by employer."
        figures={[
          { label: "Waiting at DOL now", value: "47,681", trend: { text: "1,204 fewer in 30 days", dir: "down", tone: "good" }, note: "From DOL's case-status service" },
          { label: "Decided, with the wage set", value: "886,809" },
        ]}
      />,
    );
    expect(screen.getByText("1,204 fewer in 30 days")).toBeTruthy();
    expect(screen.getByText("From DOL's case-status service")).toBeTruthy();
    // One chip in all: the second figure has none.
    expect(document.querySelectorAll("dl > div")[1]!.textContent).toBe("Decided, with the wage set 886,809 ");
  });
});
