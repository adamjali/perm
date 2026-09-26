import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

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

  it("draws the reported stops from the summary route", async () => {
    render(<CaseMilestones caseNumber={CASE} />);
    expect(await screen.findByText("2 reported")).toBeInTheDocument();
    expect(screen.getByText("none yet")).toBeInTheDocument();
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
