import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LOOKS_YEARLY_NOTE, LOOKS_YEARLY_SHORT } from "@/lib/wageFormat";

import { YearlyPayNote } from "../YearlyPayNote";

describe("YearlyPayNote", () => {
  it("says the sentence beside a wage that can't be pay for its unit", () => {
    const { container } = render(<YearlyPayNote wage={100000} unit="Month" />);
    expect(container.textContent).toBe(LOOKS_YEARLY_NOTE);
  });

  it("is short in a table cell, with the sentence on hover", () => {
    const { container } = render(<YearlyPayNote wage={95000} unit="HOUR" short />);
    const span = container.querySelector("span");
    expect(span?.textContent).toBe(LOOKS_YEARLY_SHORT);
    expect(span?.getAttribute("title")).toBe(LOOKS_YEARLY_NOTE);
  });

  it("renders nothing for an ordinary wage", () => {
    expect(render(<YearlyPayNote wage={52} unit="HOUR" />).container.textContent).toBe("");
    expect(render(<YearlyPayNote wage={180000} unit="YEAR" short />).container.textContent).toBe("");
  });
});
