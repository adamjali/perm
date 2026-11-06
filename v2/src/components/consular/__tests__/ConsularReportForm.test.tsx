import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { ConsularReportForm } from "../ConsularReportForm";

/**
 * The consulate page's report form. What must hold: nothing renders for a slug that isn't one; nothing is sent
 * without a kind of visa, a result and a date; a save sends a 64-hex key it then keeps; a question shows only
 * where it applies and its answer is dropped with the one it depends on, so a hidden field never travels; NVC's
 * month goes as YYYY-MM only once both pickers are chosen; and a returning browser gets its report back to
 * update or remove.
 */

const POST = "mumbai";
const calls: { url: string; body: Record<string, unknown> | null }[] = [];
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

function stubFetch(mine: Record<string, unknown> | null = null) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: { body?: string }) => {
      const body = init?.body ? (JSON.parse(init.body) as Record<string, unknown>) : null;
      calls.push({ url, body });
      if (url.includes("/consular-report/save")) {
        return new Response(JSON.stringify({ ok: true, message: "Your report is saved. Thanks for adding it." }), { status: 200 });
      }
      if (url.includes("/consular-report/remove")) {
        return new Response(JSON.stringify({ ok: true, message: "Your report was removed." }), { status: 200 });
      }
      return new Response(JSON.stringify({ ok: true, mine }), { status: 200 });
    }),
  );
}

beforeEach(() => {
  calls.length = 0;
  vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "https://example.convex.cloud");
  window.localStorage.clear();
  stubFetch();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const pick = (label: RegExp | string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const sent = () => calls.find((c) => c.url.includes("/consular-report/save"))?.body ?? null;
const saveButton = () => screen.getByRole("button", { name: /save my report|save changes/i });

describe("ConsularReportForm", () => {
  it("renders nothing for a slug that isn't one", () => {
    const { container } = render(<ConsularReportForm post="../admin" name="Nowhere" />);
    expect(container.innerHTML).toBe("");
  });

  it("refuses to send a report with no kind of visa, result or date, and sends nothing", async () => {
    render(<ConsularReportForm post={POST} name="Mumbai" />);
    fireEvent.click(saveButton());
    expect(await screen.findByRole("alert")).toHaveTextContent(/kind of visa/i);
    pick("Kind of visa", "h1b");
    pick("Result", "waiting");
    fireEvent.click(saveButton());
    expect(await screen.findByRole("alert")).toHaveTextContent(/at least one date/i);
    expect(sent()).toBeNull();
  });

  it("sends a 64-hex key with the report's fields and keeps the key for next time", async () => {
    render(<ConsularReportForm post={POST} name="Mumbai" />);
    pick("Kind of visa", "employment");
    pick("Interview", daysAgo(5));
    pick("Result", "issued");
    fireEvent.click(saveButton());
    await waitFor(() => expect(sent()).not.toBeNull());
    const body = sent()!;
    expect(body.post).toBe(POST);
    expect(body.key).toMatch(/^[0-9a-f]{64}$/);
    expect(body).toMatchObject({ category: "employment", interviewOn: daysAgo(5), outcome: "issued" });
    // Nothing the form doesn't ask for travels: no name, no case number, no notes.
    expect(Object.keys(body).every((k) => ["post", "key", "category", "interviewOn", "outcome"].includes(k))).toBe(true);
    await waitFor(() => expect(window.localStorage.getItem(`pt-consular-key:${POST}`)).toBe(body.key));
    expect(await screen.findByRole("status")).toHaveTextContent(/within a day/);
  });

  it("asks the drop box and 221(g) questions only for a nonimmigrant visa, and drops their answers with it", async () => {
    render(<ConsularReportForm post={POST} name="Mumbai" />);
    pick("Kind of visa", "employment");
    expect(screen.queryByLabelText("Interview or drop box")).toBeNull();
    expect(screen.getByRole("group", { name: /NVC said the case was complete/i })).toBeInTheDocument();

    pick("Kind of visa", "h1b");
    expect(screen.queryByRole("group", { name: /NVC said the case was complete/i })).toBeNull();
    pick("Interview or drop box", "interview");
    pick("Interview", daysAgo(9));
    pick("Result", "221g");
    pick("Colour of the 221(g) slip", "white");
    pick("Asked to email documents", "yes");
    // A 221(g) that became an issued visa: the slip and the emailed documents go with the 221(g).
    pick("Result", "issued");
    expect(screen.queryByLabelText("Colour of the 221(g) slip")).toBeNull();
    fireEvent.click(saveButton());
    await waitFor(() => expect(sent()).not.toBeNull());
    expect(sent()).toMatchObject({ category: "h1b", mode: "interview", outcome: "issued" });
    expect(sent()!.slipColor ?? null).toBeNull();
    expect(sent()!.askedToEmailDocs ?? null).toBeNull();
  });

  it("asks the exact category, why the 221(g) and who cancelled only where they apply, and drops each with it", async () => {
    render(<ConsularReportForm post={POST} name="Mumbai" />);
    pick("Kind of visa", "h1b");
    expect(screen.queryByLabelText("Exact category")).toBeNull();
    pick("Kind of visa", "family");
    pick("Exact category", "f2a");
    // A different kind of visa has its own list: F2A isn't an employment category, so it goes.
    pick("Kind of visa", "employment");
    expect(screen.getByLabelText("Exact category")).toHaveValue("");
    pick("Exact category", "eb2");
    pick("Interview", daysAgo(6));
    pick("Result", "221g");
    pick("Why the 221(g)", "public-charge");
    pick("Result", "cancelled");
    expect(screen.queryByLabelText("Why the 221(g)")).toBeNull();
    pick("Who cancelled or moved it", "consulate");
    fireEvent.click(saveButton());
    await waitFor(() => expect(sent()).not.toBeNull());
    expect(sent()).toMatchObject({ category: "employment", line: "eb2", outcome: "cancelled", cancelledBy: "consulate" });
    expect(sent()!.holdReason ?? null).toBeNull();
  });

  it("calls the date a drop-off when the visa went into the drop box", () => {
    render(<ConsularReportForm post={POST} name="Mumbai" />);
    pick("Kind of visa", "h4");
    pick("Interview or drop box", "dropbox");
    expect(screen.getByLabelText("Documents dropped off")).toBeInTheDocument();
  });

  it("sends NVC's month as YYYY-MM only once both pickers are chosen", async () => {
    render(<ConsularReportForm post={POST} name="Mumbai" />);
    pick("Kind of visa", "family");
    pick("Result", "waiting");
    pick("Month NVC said the case was complete", "03");
    fireEvent.click(saveButton());
    expect(await screen.findByRole("alert")).toHaveTextContent(/both the month and the year/i);
    expect(sent()).toBeNull();
    pick("Year NVC said the case was complete", "2026");
    fireEvent.click(saveButton());
    await waitFor(() => expect(sent()).not.toBeNull());
    expect(sent()!.nvcCompleteMonth).toBe("2026-03");
  });

  it("gives a returning browser its report back, to update or remove", async () => {
    window.localStorage.setItem(`pt-consular-key:${POST}`, "a".repeat(64));
    stubFetch({ category: "k1", outcome: "waiting", nvcCompleteMonth: "2026-02", scheduledOn: daysAgo(30) });
    render(<ConsularReportForm post={POST} name="Mumbai" />);
    expect(await screen.findByText("Your report for this consulate")).toBeInTheDocument();
    expect((screen.getByLabelText("Kind of visa") as HTMLSelectElement).value).toBe("k1");
    expect((screen.getByLabelText("Year NVC said the case was complete") as HTMLSelectElement).value).toBe("2026");
    // The key goes in the body of a POST, never in an address.
    const mine = calls.find((c) => c.url.includes("/consular-report/mine"))!;
    expect(mine.url).not.toContain("a".repeat(64));
    expect(mine.body).toEqual({ post: POST, key: "a".repeat(64) });

    fireEvent.click(screen.getByRole("button", { name: "Remove my report" }));
    await waitFor(() => expect(window.localStorage.getItem(`pt-consular-key:${POST}`)).toBeNull());
    expect(await screen.findByText("Add your report")).toBeInTheDocument();
  });
});
