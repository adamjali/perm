import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PermDeadlineCalculator } from "../PermDeadlineCalculator";
import { calculateFilingWindow } from "@/lib/perm";

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

describe("the PWD cap, asserted at the source", () => {
  /**
   * The component renders a caption when the cap applies, and asserting the
   * caption is an indirect test: it would keep passing if the flag were right
   * and the date wrong, or if someone made the caption unconditional. This
   * pins the contract itself, so a regression to the raw calculator fails here
   * with a clear reason rather than as a missing string in the DOM.
   */
  it("closes on the PWD date and reports isPwdLimited when the PWD expires first", () => {
    const w = calculateFilingWindow({
      firstRecruitmentDate: "2026-02-01", // natural close 2026-07-31
      lastRecruitmentDate: "2026-03-01",
      pwdExpirationDate: "2026-06-30", // earlier, so it caps
    });
    expect(w).not.toBeNull();
    expect(w!.closes).toBe("2026-06-30");
    expect(w!.isPwdLimited).toBe(true);
    // The raw calculator's answer, which is what a regression would print.
    // Naming it here is the point: this date is one on which filing is barred.
    expect(w!.closes).not.toBe("2026-07-31");
  });

  it("closes on the 180-day limit and reports no cap when the PWD outlives it", () => {
    const w = calculateFilingWindow({
      firstRecruitmentDate: "2026-01-10", // natural close 2026-07-09
      lastRecruitmentDate: "2026-02-10",
      pwdExpirationDate: "2026-08-30", // later, so it does not cap
    });
    expect(w).not.toBeNull();
    expect(w!.closes).toBe("2026-07-09");
    expect(w!.isPwdLimited).toBe(false);
  });
});

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

  /**
   * OFLC stopped processing on 1 October 2025 and DOL later said it would take
   * PERM filings on recruitment that expired during the 33 days FLAG was down.
   * The regulation is unchanged and so are the computed dates; the exception
   * is stated beside them, because printing "your window closed" alone is
   * wrong for the one cohort DOL covered.
   */
  describe("the October 2025 shutdown note", () => {
    it("fires when the 180-day recruitment expiry lands in DOL's window", () => {
      render(<PermDeadlineCalculator />);
      setDate(/prevailing wage determination date/i, "2025-01-10");
      setDate(/first recruitment step/i, "2025-04-20"); // + 180 = 2025-10-17
      expect(screen.getByText(/expired during the 2025 shutdown/i)).toBeInTheDocument();
      expect(screen.getByText(/October 17, 2025/)).toBeInTheDocument();
      expect(
        screen.getByText(/33 calendar day period/i),
      ).toBeInTheDocument();
    });

    it("does not fire a day either side of it", () => {
      // 2025-04-03 + 180 = 2025-09-30, one day early.
      const { unmount } = render(<PermDeadlineCalculator />);
      setDate(/prevailing wage determination date/i, "2025-01-10");
      setDate(/first recruitment step/i, "2025-04-03");
      expect(screen.queryByText(/expired during the 2025 shutdown/i)).not.toBeInTheDocument();
      unmount();

      // 2025-05-07 + 180 = 2025-11-03, one day late.
      render(<PermDeadlineCalculator />);
      setDate(/prevailing wage determination date/i, "2025-01-10");
      setDate(/first recruitment step/i, "2025-05-07");
      expect(screen.queryByText(/expired during the 2025 shutdown/i)).not.toBeInTheDocument();
    });

    it("stays out of the way for an ordinary present-day case", () => {
      render(<PermDeadlineCalculator />);
      setDate(/prevailing wage determination date/i, "2026-01-15");
      setDate(/first recruitment step/i, "2026-02-01");
      expect(screen.queryByText(/2025 shutdown/i)).not.toBeInTheDocument();
    });

    it("is not styled or announced as a warning", () => {
      // The exception WIDENED what DOL accepted. Putting it in the alert band
      // would tell a reader they have a problem when they have the opposite.
      render(<PermDeadlineCalculator />);
      setDate(/prevailing wage determination date/i, "2025-01-10");
      setDate(/first recruitment step/i, "2025-04-20");
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("shows the note above the dates it qualifies", () => {
      // A reader who meets "the window closed" first and stops reading has
      // been told the wrong thing.
      const { container } = render(<PermDeadlineCalculator />);
      setDate(/prevailing wage determination date/i, "2025-01-10");
      setDate(/first recruitment step/i, "2025-04-20");
      const note = screen.getByText(/expired during the 2025 shutdown/i);
      const closes = screen.getByText(/ETA-9089 filing window closes/i);
      expect(
        note.compareDocumentPosition(closes) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(container).toBeTruthy();
    });
  });

  it("warns when the quiet period runs past the filing deadline", () => {
    render(<PermDeadlineCalculator />);
    setDate(/prevailing wage determination date/i, "2026-01-02"); // long validity irrelevant here
    setDate(/first recruitment step/i, "2026-01-10");
    setDate(/last recruitment step/i, "2026-06-25"); // opens 07-25, closes 07-09
    expect(screen.getByRole("alert")).toHaveTextContent(/opens after it closes/i);
  });
});
