import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { H1bLotteryCalculator } from "../H1bLotteryCalculator";

/**
 * The calculator end to end against a stubbed DOL: the areas list, the four
 * figures, the level the rule assigns and DHS's estimate at it. The arithmetic
 * is tested in lib; this checks the page asks for the right thing and prints
 * the answer with its sources, and that a missing OEWS wage is said rather
 * than guessed.
 */

const LEVELS = [
  { level: "I", hourly: 50, yearly: 104000 },
  { level: "II", hourly: 60, yearly: 124800 },
  { level: "III", hourly: 70, yearly: 145600 },
  { level: "IV", hourly: 80, yearly: 166400 },
];

function stub(levels: typeof LEVELS | null) {
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      calls.push(url);
      if (url.startsWith("/api/wage-areas")) {
        return new Response(JSON.stringify({ areas: [{ value: 41884, label: "San Francisco-Oakland-Hayward, CA" }] }));
      }
      return new Response(JSON.stringify({ ok: true, levels, message: levels ? undefined : "none" }));
    }),
  );
  return calls;
}

async function fill() {
  fireEvent.change(screen.getByLabelText("SOC code"), { target: { value: "15-1252" } });
  fireEvent.change(screen.getByLabelText("Offered wage"), { target: { value: "130,000" } });
  fireEvent.change(screen.getByLabelText("Work state"), { target: { value: "CA" } });
  await waitFor(() => expect(screen.getByLabelText("Area")).not.toBeDisabled());
  fireEvent.click(screen.getByRole("button", { name: /Work out the level/ }));
}

describe("H1bLotteryCalculator", () => {
  beforeEach(() => vi.unstubAllGlobals());
  afterEach(() => vi.unstubAllGlobals());

  it("asks DOL for the job in the chosen area and prints the level and DHS's estimate", async () => {
    const calls = stub(LEVELS);
    render(<H1bLotteryCalculator />);
    await fill();
    expect(await screen.findByText("The level the rule assigns")).toBeInTheDocument();
    const levelCall = calls.find((c) => c.startsWith("/api/wage-levels"))!;
    expect(levelCall).toContain("soc=15-1252");
    expect(levelCall).toContain("area=41884");
    const text = document.body.textContent ?? "";
    expect(text).toContain("The level the rule assigns Level II Entered in the draw twice.");
    expect(text).toContain("30.6%");
    expect(text).toContain("Level III: $145,600 a year");
    expect(text).toContain("8 CFR 214.2(h)(8)(iii)(A)(4)");
  });

  it("says when DOL has no OEWS wage instead of assigning a level", async () => {
    stub(null);
    render(<H1bLotteryCalculator />);
    await fill();
    expect(await screen.findByText(/DOL publishes no OEWS wage/)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("The level the rule assigns");
  });
});
