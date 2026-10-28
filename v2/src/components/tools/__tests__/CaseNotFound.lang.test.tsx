import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LANGS } from "@/lib/i18n/lang";
import { parseCaseNumber } from "@/lib/permCaseNumber";
import { CaseNotFound } from "../CaseNotFound";
import { CASE_NOT_FOUND } from "../CaseNotFound.messages";
import { DOL_MISS } from "@/lib/dolMiss.messages";

const base = {
  caseNumber: "G-100-26125-868956",
  parsed: parseCaseNumber("G-100-26125-868956"),
  cohort: { month: "2026-05", total: 15034, pending: 12000, decidedPct: 20.2 } as never,
  wall: null,
  neighbours: [],
  publishedFront: null,
  publishedAsOf: null,
  mirrorSize: 426112,
};

const text = (el: HTMLElement) => (el.textContent ?? "").replace(/\s+/g, " ");

describe("the not-found answer in each language", () => {
  it("English is unchanged where the facts were right, and corrected where they weren't", () => {
    const { container } = render(<CaseNotFound {...base} dolMiss="none" />);
    const t = text(container);
    expect(t).toContain(
      "We hold no record for this number. That isn't a statement about the case, only that this project hasn't got it, and DOL's own case-status search is the authority either way.",
    );
    expect(t).toContain("Checked 426,112 per-case statuses and DOL's decided files since October 2015, then asked DOL directly");
    expect(t).toContain("It was decided before October 2015. DOL's published decision files we hold start then.");
    expect(t).not.toContain("mid-2023");
    expect(t).toContain("Check it against the receipt, or find the case by employer name.");
    expect(t).toContain("Cases filed in May 2026");
    expect(t).toContain("20.2% of the month is decided");
  });

  it("the unsettled answer keeps its English sentence word for word", () => {
    const { container } = render(<CaseNotFound {...base} dolMiss="unavailable" />);
    expect(text(container)).toContain(
      "We hold no record for G-100-26125-868956 yet, and DOL's case system didn't answer when we asked just now (it gets 8 seconds), so we can't say whether DOL has it. That's usually brief. Try again or use DOL's own case-status search.",
    );
  });

  it("a translated page's retry stays on its own language", () => {
    render(<CaseNotFound {...base} dolMiss="unavailable" lang="es" />);
    expect(screen.getByRole("link", { name: "Inténtelo de nuevo" })).toHaveAttribute(
      "href",
      "/es/perm-case-status?case=G-100-26125-868956",
    );
    expect(screen.getByText(DOL_MISS.es.verdict.unavailable)).toBeInTheDocument();
  });

  it("Spanish dates and numbers are in its own form", () => {
    const { container } = render(<CaseNotFound {...base} dolMiss="none" lang="es" />);
    const t = text(container);
    expect(t).toContain("Casos presentados en mayo de 2026");
    expect(t).toContain("20,2 % del mes ya está decidido");
    expect(t).toContain("Se revisaron 426.112 estados");
  });

  it("Chinese joins with no stray spaces between its own words", () => {
    render(<CaseNotFound {...base} dolMiss="unavailable" lang="zh" />);
    // The sentence itself; the heading and the source line around it are separate lines on screen.
    const t = text(screen.getByText(/我们还没有/).closest("p, div") as HTMLElement);
    expect(t).toContain("重试，或使用劳工部自己的案件状态查询。");
    expect(t).not.toMatch(/[一-鿿。，] [一-鿿]/);
  });

  it("Korean attaches its particles to the link before them", () => {
    const { container } = render(<CaseNotFound {...base} dolMiss="none" lang="ko" />);
    expect(text(container)).toContain("노동부 자체 케이스 상태 조회가 기준입니다.");
  });

  it("every language fills every part, so no English is left on a translated page", () => {
    for (const lang of LANGS) {
      if (lang === "en") continue;
      const { container, unmount } = render(<CaseNotFound {...base} dolMiss="none" lang={lang} />);
      const t = text(container);
      expect(t, lang).not.toContain("Not in our records");
      expect(t, lang).not.toContain("Why a real case can be missing here");
      expect(t, lang).toContain(CASE_NOT_FOUND[lang].whyTitle);
      unmount();
    }
  });
});
