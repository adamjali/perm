import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { CaseNumberField } from "../CaseNumberField";

/**
 * The failure that matters here is the quiet one: a number that does not
 * decode must NOT leave the month picker where it was without saying so,
 * because a wrong queue position is invisible to the person reading it.
 */

// Day 125 of 2026 is 2026-05-05.
const VALID = "G-100-26125-868956";

function setup() {
  const onDecode = vi.fn();
  render(<CaseNumberField onDecode={onDecode} />);
  return { onDecode, input: screen.getByLabelText(/case number/i) };
}

describe("CaseNumberField", () => {
  it("decodes a case number and reports its filing month", () => {
    const { onDecode, input } = setup();
    fireEvent.change(input, { target: { value: VALID } });
    expect(onDecode).toHaveBeenCalledTimes(1);
    expect(onDecode.mock.calls[0]![0]).toMatchObject({
      filingMonth: "2026-05",
      filingDate: "2026-05-05",
    });
    expect(screen.getByText("May 2026")).toBeInTheDocument();
  });

  it("shows how exact the decoded date is, beside the date", () => {
    const { input } = setup();
    fireEvent.change(input, { target: { value: VALID } });
    expect(screen.getByText(/matches exactly for 89%/)).toBeInTheDocument();
  });

  it("refuses a number it cannot decode instead of guessing", () => {
    const { onDecode, input } = setup();
    fireEvent.change(input, { target: { value: "not-a-case-number" } });
    expect(onDecode).not.toHaveBeenCalled();
    expect(screen.getByText(/not a PERM case number/)).toBeInTheDocument();
    expect(input).toHaveAttribute("aria-invalid", "true");
  });

  it("treats an empty box as no input, not as an error", () => {
    const { input } = setup();
    fireEvent.change(input, { target: { value: VALID } });
    fireEvent.change(input, { target: { value: "" } });
    expect(screen.queryByText(/not a PERM case number/)).not.toBeInTheDocument();
    expect(input).not.toHaveAttribute("aria-invalid");
  });

  it("renders a caller warning under the decoded month", () => {
    const onDecode = vi.fn();
    render(<CaseNumberField onDecode={onDecode} warning="Outside the range." />);
    fireEvent.change(screen.getByLabelText(/case number/i), {
      target: { value: VALID },
    });
    expect(screen.getByText("Outside the range.")).toBeInTheDocument();
  });

  it("labels the field above it and uses the placeholder only as an example", () => {
    const { input } = setup();
    // A placeholder that doubles as the label disappears the moment you type.
    expect(screen.getByText("Or paste your case number").tagName).toBe("LABEL");
    expect(input).toHaveAttribute("placeholder", VALID);
  });

  it("gives the input a 44px tap target", () => {
    const { input } = setup();
    expect(input.className).toContain("min-h-[44px]");
  });
});
