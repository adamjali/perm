import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PermDeadlineCalculator } from "../PermDeadlineCalculator";

/**
 * The deadline calculator is arithmetic on the central PERM model, and these
 * tests pin the two places that model was being bypassed:
 *
 * - the filing window CLOSES at the earlier of first-recruitment + 180 and the
 *   PWD expiration. The tool used to call the raw calculator, which knows
 *   nothing about the determination, and reported a close date on which filing
 *   is barred.
 * - reversed recruitment order still produces plausible-looking dates
 *   (opens = last + 30, closes = first + 180 usually keeps opens < closes),
 *   so without an explicit warning nothing downstream ever looks wrong.
 */

function setDate(label: RegExp, value: string) {
  const input = screen.getByLabelText(label) as HTMLInputElement;
  fireEvent.change(input, { target: { value } });
}

describe("PermDeadlineCalculator", () => {
  it("derives the PWD expiration from the central calculator", () => {
    render(<PermDeadlineCalculator />);
    setDate(/prevailing wage determination date/i, "2026-01-15");
    // calculatePWDExpiration implements the OEWS wage-year rule, not a naive
    // +90 days: a determination issued January 1 - April 1 expires on THAT
    // YEAR'S June 30. Asserting "+90 days" here was the first draft of this
    // test, and its failure is exactly why tools must ride the central lib
    // rather than reimplement "obvious" arithmetic.
    expect(screen.getByText(/determination expires/i)).toBeInTheDocument();
    expect(screen.getByText("June 30, 2026")).toBeInTheDocument();
  });

  it("caps the filing-window close at the PWD expiration and says so", () => {
    render(<PermDeadlineCalculator />);
    setDate(/prevailing wage determination date/i, "2026-01-15"); // expires 2026-06-30
    setDate(/first recruitment step/i, "2026-02-01"); // natural close 2026-07-31
    // The PWD expires well before first + 180, so the close must be the
    // expiration and the caption must explain the cap.
    expect(screen.getByText(/ETA-9089 filing window closes/i)).toBeInTheDocument();
    expect(screen.getAllByText("June 30, 2026").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/capped by the prevailing wage expiration/i)).toBeInTheDocument();
  });

  it("shows the natural 180-day close when the PWD outlives it", () => {
    render(<PermDeadlineCalculator />);
    setDate(/prevailing wage determination date/i, "2026-06-01"); // expires 2026-08-30
    setDate(/first recruitment step/i, "2026-01-10"); // natural close 2026-07-09
    // The window diagram repeats dates on its axis, so count, not unique.
    expect(screen.getAllByText("July 9, 2026").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/one hundred and eighty days/i)).toBeInTheDocument();
    expect(screen.queryByText(/capped by the prevailing wage/i)).not.toBeInTheDocument();
  });

  it("warns on reversed recruitment order and withholds the window", () => {
    render(<PermDeadlineCalculator />);
    setDate(/prevailing wage determination date/i, "2026-06-01");
    setDate(/first recruitment step/i, "2026-03-10");
    setDate(/last recruitment step/i, "2026-02-01"); // before the first
    expect(screen.getByRole("alert")).toHaveTextContent(/last recruitment step is before the first/i);
    expect(screen.queryByText(/ETA-9089 filing window opens/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/ETA-9089 filing window closes/i)).not.toBeInTheDocument();
  });

  it("warns when recruitment begins after the determination expires", () => {
    render(<PermDeadlineCalculator />);
    setDate(/prevailing wage determination date/i, "2026-01-15"); // expires 2026-06-30
    setDate(/first recruitment step/i, "2026-07-15"); // after expiration
    expect(screen.getByRole("alert")).toHaveTextContent(/after the prevailing wage determination expires/i);
  });

  it("warns when the quiet period runs past the filing deadline", () => {
    render(<PermDeadlineCalculator />);
    setDate(/prevailing wage determination date/i, "2026-01-02"); // long validity irrelevant here
    setDate(/first recruitment step/i, "2026-01-10");
    setDate(/last recruitment step/i, "2026-06-25"); // opens 07-25, closes 07-09
    expect(screen.getByRole("alert")).toHaveTextContent(/opens after it closes/i);
  });
});
