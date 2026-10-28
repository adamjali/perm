import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { LangProvider } from "@/components/i18n/LangProvider";
import type { Lang } from "@/lib/i18n/lang";

import { CaseMilestones } from "../CaseMilestones";

/**
 * The case page's timeline form. What must hold: nothing renders for a
 * number that isn't PERM; the public box starts unticked; a save sends a
 * 64-hex key it then keeps; nothing is sent when no date after PERM is given;
 * and the counts come from the summary route, never invented.
 */

const CASE = "G-100-25324-425560";
const calls: { url: string; body: Record<string, unknown> | null }[] = [];

beforeEach(() => {
  calls.length = 0;
  vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "https://example.convex.cloud");
  window.localStorage.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: { body?: string }) => {
      const body = init?.body ? (JSON.parse(init.body) as Record<string, unknown>) : null;
      calls.push({ url, body });
      if (url.includes("/timeline/summary")) {
        return new Response(
          JSON.stringify({
            caseNumber: CASE,
            timelines: 1,
            stops: [
              { id: "i140FiledOn", label: "I-140 filed", verified: false, count: 2 },
              { id: "i140ApprovedOn", label: "I-140 approved", verified: false, count: 0 },
            ],
          }),
          { status: 200 },
        );
      }
      if (url.includes("/timeline/save")) {
        return new Response(JSON.stringify({ ok: true, message: "Your timeline is recorded." }), { status: 200 });
      }
      return new Response(JSON.stringify({ ok: true, mine: null }), { status: 200 });
    }),
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("CaseMilestones (the timeline form)", () => {
  it("renders nothing for a number that is not a PERM case", () => {
    const { container } = render(<CaseMilestones caseNumber="P-100-26125-868956" />);
    expect(container.innerHTML).toBe("");
  });

  it("names the reported stops from the summary route, and only those", async () => {
    render(<CaseMilestones caseNumber={CASE} />);
    const line = (await screen.findByText(/Reported for this case/)).textContent ?? "";
    expect(line).toMatch(/Reported for this case: I-140 filed \(2\)\./);
    // A stop nobody reported isn't listed.
    expect(line).not.toMatch(/I-140 approved/);
  });

  it("starts with the public box unticked", () => {
    render(<CaseMilestones caseNumber={CASE} />);
    expect(screen.getByRole("checkbox", { name: /show my timeline on the public board/i })).not.toBeChecked();
  });

  it("refuses to send a timeline with no date after PERM", async () => {
    render(<CaseMilestones caseNumber={CASE} />);
    fireEvent.click(screen.getByRole("button", { name: /save my timeline/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/at least one date/i);
    expect(calls.some((c) => c.url.includes("/timeline/save"))).toBe(false);
  });

  it("sends a 64-hex key with the fields and keeps the key for next time", async () => {
    render(<CaseMilestones caseNumber={CASE} />);
    fireEvent.change(screen.getByLabelText("I-140 filed"), { target: { value: "2026-05-01" } });
    fireEvent.click(screen.getByRole("button", { name: /save my timeline/i }));
    await waitFor(() => expect(calls.some((c) => c.url.includes("/timeline/save"))).toBe(true));
    const sent = calls.find((c) => c.url.includes("/timeline/save"))!.body!;
    expect(sent.caseNumber).toBe(CASE);
    expect(sent.key).toMatch(/^[0-9a-f]{64}$/);
    expect(sent.i140FiledOn).toBe("2026-05-01");
    expect(sent.public).toBe(false);
    await waitFor(() => expect(window.localStorage.getItem(`pt-timeline-key:${CASE}`)).toBe(sent.key));
  });
});

describe("CaseMilestones in another language", () => {
  const inLang = (lang: Lang) =>
    render(
      <LangProvider lang={lang}>
        <CaseMilestones caseNumber={CASE} />
      </LangProvider>,
    );

  /** The browser already holds a key for this case, and the server finds its timeline. */
  function withMine(mine: { permFiledOn: string | null; permCertifiedOn: string }) {
    window.localStorage.setItem(`pt-timeline-key:${CASE}`, "a".repeat(64));
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/timeline/summary")) {
          return new Response(JSON.stringify({ caseNumber: CASE, timelines: 1, stops: [] }), { status: 200 });
        }
        return new Response(
          JSON.stringify({ ok: true, mine: { input: { route: "adjustment", public: false }, ...mine } }),
          { status: 200 },
        );
      }),
    );
  }

  it("words the block, the form and the reported stops in Spanish, by each stop's id", async () => {
    inLang("es");
    expect(screen.getByRole("heading", { name: "Después del PERM" })).toBeInTheDocument();
    const line = (await screen.findByText(/Fechas informadas para este caso/)).textContent ?? "";
    // The server sends "I-140 filed"; the page names the stop by its id instead.
    expect(line).toBe("Fechas informadas para este caso: I-140 presentada (2).");
    expect(screen.getByLabelText("Categoría")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "EB-3 Otros Trabajadores" })).toBeInTheDocument();
    expect(screen.getAllByRole("option", { name: "Prefiero no decirlo" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("checkbox", { name: /mostrar mi cronología en el tablero público/i })).not.toBeChecked();
    expect(screen.getByRole("link", { name: "cronologías de green card (en inglés)" })).toHaveAttribute(
      "href",
      "/green-card-timelines",
    );
    expect(document.body.textContent).not.toMatch(/Save my timeline|Add your dates|Not saying/);
  });

  it("uses Chinese punctuation for the reported stops", async () => {
    inLang("zh");
    const line = (await screen.findByText(/本案已填报/)).textContent ?? "";
    expect(line).toBe("本案已填报：I-140 已递交（2）。");
  });

  it("says the form's own refusal in the reader's language, and sends nothing", async () => {
    inLang("ko");
    fireEvent.click(screen.getByRole("button", { name: "내 타임라인 저장" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("PERM 이후 날짜를 하나 이상 추가해 주세요");
    expect(calls.some((c) => c.url.includes("/timeline/save"))).toBe(false);
  });

  it("translates the server's fixed reply and keeps the save working", async () => {
    inLang("pt-br");
    fireEvent.change(screen.getByLabelText("I-140 protocolada"), { target: { value: "2026-05-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar minha linha do tempo" }));
    // The server answers "Your timeline is recorded."
    // (The button's own busy state is a status too, so the reply is found by its words.)
    expect((await screen.findByText("Sua linha do tempo foi registrada.")).closest("[role=status]")).not.toBeNull();
    expect(calls.find((c) => c.url.includes("/timeline/save"))!.body!.i140FiledOn).toBe("2026-05-01");
  });

  it("dates DOL's own half in the reader's language, and in English as before", async () => {
    withMine({ permFiledOn: "2025-09-05", permCertifiedOn: "2026-03-02" });
    const { unmount } = inLang("es");
    expect((await screen.findByText(/Registro del DOL para este caso/)).textContent).toBe(
      "Registro del DOL para este caso: presentado el 5 sept 2025, certificado el 2 mar 2026.",
    );
    unmount();
    withMine({ permFiledOn: null, permCertifiedOn: "2026-03-02" });
    render(<CaseMilestones caseNumber={CASE} />);
    expect((await screen.findByText(/DOL's record for this case/)).textContent).toBe(
      "DOL's record for this case: filed on a date DOL doesn't show, certified Mar 2, 2026.",
    );
  });
});
