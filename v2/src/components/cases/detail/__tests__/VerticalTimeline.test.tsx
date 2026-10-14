/**
 * The next step on a case's timeline is outlined and says "Next".
 *
 * It was filled lime, the same as a finished step, so a case waiting on its
 * PWD determination read as if the determination had arrived (Oct 14 2026).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { addDays, format } from "date-fns";
import { renderWithProviders } from "../../../../../test-utils/render-utils";
import { VerticalTimeline } from "../VerticalTimeline";
import type { CaseDetailData } from "../case-detail-types";

const iso = (d: Date) => format(d, "yyyy-MM-dd");

describe("VerticalTimeline", () => {
  it("marks one step as next, apart from the steps already done", () => {
    const caseData = {
      _id: "case-1",
      pwdFilingDate: iso(addDays(new Date(), -60)),
    } as unknown as CaseDetailData;

    const { container } = renderWithProviders(<VerticalTimeline caseData={caseData} />);

    const done = container.querySelectorAll(".vtl-icon.done");
    const current = container.querySelectorAll(".vtl-icon.current");
    expect(done.length).toBe(1);
    expect(current.length).toBe(1);
    const currentStep = current[0]!.closest(".vtl-step")!;
    expect(currentStep.textContent).toContain("PWD determined");
    expect(currentStep.querySelector(".vtl-date")!.textContent).toBe("Next");
  });

  it("draws the next step unfilled, unlike a finished one", () => {
    const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");
    const rule = (sel: string) => {
      const m = css.match(new RegExp(`${sel.replace(/\./g, "\\.")}\\s*\\{([^}]*)\\}`));
      if (!m) throw new Error(`no rule for ${sel}`);
      return m[1]!;
    };
    const background = (r: string) => r.match(/background:\s*([^;]+)/)?.[1]?.trim();
    expect(background(rule(".vtl-icon.current"))).not.toBe(background(rule(".vtl-icon.done")));
  });
});
