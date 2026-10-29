import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { CaseStatusHead } from "../CaseStatusShell";

/**
 * The loading state and its fallback stay in the streamed HTML, so three real
 * <h1> tags gave crawlers the page's heading three times (Oct 1 2026). Only
 * the page's own copy is an <h1>; the loading copies look the same and keep a
 * level-1 heading role for screen readers.
 */
describe("CaseStatusHead", () => {
  it("renders the page's one <h1>", () => {
    const { container } = render(<CaseStatusHead typed="" />);
    expect(container.querySelectorAll("h1")).toHaveLength(1);
  });

  it("renders no <h1> while loading, still announced as a level-1 heading", () => {
    const { container } = render(<CaseStatusHead typed="G-100-26239-123456" loading />);
    expect(container.querySelectorAll("h1")).toHaveLength(0);
    expect(screen.getByRole("heading", { level: 1, name: "Check and track your PERM case status" })).toBeInTheDocument();
  });

  it("looks the same either way", () => {
    const page = render(<CaseStatusHead typed="" />).container.querySelector("h1")!.className;
    const loading = render(<CaseStatusHead typed="" loading />).container.querySelector('[role="heading"]')!.className;
    expect(loading).toBe(page);
  });
});

describe("the case status frame in each language", () => {
  it.each([
    ["es", "Consulte y siga el estado de su caso PERM", "Consulte una solicitud de salario prevaleciente"],
    ["zh", "查询并追踪您的 PERM 案件状态", "查询现行工资认定申请"],
    ["pt-br", "Consulte e acompanhe o status do seu caso PERM", "Consulte um pedido de salário prevalecente"],
    ["ko", "PERM 케이스 상태 조회 및 추적", "적정임금(PWD) 신청 조회"],
    ["vi", "Tra cứu và theo dõi tình trạng hồ sơ PERM", "Tra cứu đơn xác định mức lương hiện hành"],
  ] as const)("%s names the program the typed number belongs to", (lang, perm, pwd) => {
    render(<CaseStatusHead typed="" lang={lang} />);
    expect(screen.getByRole("heading", { level: 1, name: perm })).toBeInTheDocument();
    render(<CaseStatusHead typed="P-100-26125-123456" lang={lang} withBox={false} />);
    expect(screen.getByRole("heading", { level: 1, name: pwd })).toBeInTheDocument();
  });

  it("answers how long in every language from the figures it has, and never prints a missing one", async () => {
    const { CASE_STATUS, waitFigure } = await import("../caseStatus.messages");
    const full = { day: "DAY", wait: "WAIT", frontier: "FRONT", avgDays: "AVG", decidedIn: "MONTH", asOf: "ASOF" };
    const none = { day: null, wait: null, frontier: null, avgDays: null, decidedIn: null, asOf: null };
    for (const [lang, t] of Object.entries(CASE_STATUS)) {
      expect(t.faqs.some((f) => f.a.includes("{{howLong}}")), lang).toBe(true);
      if (lang === "en") continue; // English answers with howLongSentence (lib/dolNow.ts).
      const all = t.howLong(full);
      for (const v of Object.values(full)) expect(all, `${lang} carries ${v}`).toContain(v);
      for (const f of [all, t.howLong(none), t.howLong({ ...none, frontier: "FRONT" }), t.howLong({ ...none, avgDays: "AVG" })]) {
        expect(f.length, lang).toBeGreaterThan(10);
        expect(f, lang).not.toMatch(/null|undefined|NaN/);
      }
      expect(t.howLong(none), lang).toContain("flag.dol.gov/processingtimes");
      expect(t.waitWords(waitFigure(290), String), lang).toContain("9.5");
      expect(t.waitWords(waitFigure(10), String), lang).toContain("10");
    }
  });

  it("every translation fills every FAQ and keeps the English count", async () => {
    const { CASE_STATUS } = await import("../caseStatus.messages");
    for (const [lang, t] of Object.entries(CASE_STATUS)) {
      expect(t.faqs, lang).toHaveLength(CASE_STATUS.en.faqs.length);
      for (const f of t.faqs) expect(f.q.length > 3 && f.a.length > 20, `${lang}: ${f.q}`).toBe(true);
      if (lang !== "en") expect(t.termsNote.length, lang).toBeGreaterThan(15);
    }
  });
});
