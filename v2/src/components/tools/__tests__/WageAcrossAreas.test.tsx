import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { orderAreas, readWage, WageAcrossAreas } from "../WageAcrossAreas";

// Software developers, July 2026 series, three Texas areas (yearly at 2,080 hours). Wichita Falls carries
// Abilene's figures so that cheapest-first and alphabetical order disagree.
const AREAS = [
  { area: "12420", name: "Austin-Round Rock-San Marcos, TX", yearly: [95_888, 119_642, 143_395, 167_149], label: null },
  { area: "48660", name: "Wichita Falls, TX", yearly: [64_917, 85_654, 106_371, 127_109], label: null },
  { area: "11100", name: "Amarillo, TX", yearly: [80_683, 99_091, 117_520, 135_928], label: null },
];

describe("ordering and reading", () => {
  it("puts the highest level first, and within a level the cheapest Level II first", () => {
    expect(orderAreas(AREAS, 120_000).map((a) => [a.name.split(",")[0], a.reached])).toEqual([
      ["Wichita Falls", 3],
      ["Amarillo", 3],
      ["Austin-Round Rock-San Marcos", 2],
    ]);
  });

  it("reads a yearly figure however it's typed, and refuses an hourly one", () => {
    expect(readWage("$120,000")).toBe(120_000);
    expect(readWage(" 98500 ")).toBe(98_500);
    expect(readWage("57.52")).toBeNull();
    expect(readWage("abc")).toBeNull();
  });
});

describe("WageAcrossAreas", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  const ok = () => fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true, wageYear: 2026, areas: AREAS }), { status: 200 }));

  it("draws every area at the looked-up area's Level II before anything is typed", async () => {
    ok();
    render(<WageAcrossAreas soc="15-1252" state="TX" stateName="Texas" startWage={119_642} currentArea="12420" />);
    expect(fetchMock).toHaveBeenCalledWith("/api/wage-levels/areas?soc=15-1252&state=TX");
    const counts = await screen.findByLabelText(/Areas of Texas where \$119,642 reaches each level/);
    expect(within(counts).getAllByRole("listitem").map((li) => li.textContent?.replace(/\s+/g, " ").trim())).toEqual([
      expect.stringMatching(/^Level IV.*0 areas/),
      expect.stringMatching(/^Level III.*2 areas/),
      expect.stringMatching(/^Level II.*1 area$/),
      expect.stringMatching(/^Level I.*0 areas/),
      expect.stringMatching(/^Below Level I.*0 areas/),
    ]);
    expect(screen.getByText("(the area you looked up)")).toBeTruthy();
  });

  it("moves every area's answer when the wage changes", async () => {
    ok();
    render(<WageAcrossAreas soc="15-1252" state="TX" stateName="Texas" startWage={119_642} currentArea="12420" />);
    await screen.findByLabelText(/Areas of Texas where/);
    fireEvent.change(screen.getByLabelText("A yearly wage"), { target: { value: "170,000" } });
    const counts = await screen.findByLabelText(/Areas of Texas where \$170,000 reaches each level/);
    expect(within(counts).getAllByRole("listitem")[0].textContent).toMatch(/3 areas/);
  });

  it("says the tables couldn't be read when the route fails, and draws nothing", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: false, message: "The stored wage tables couldn't be read just now." }), { status: 503 }));
    render(<WageAcrossAreas soc="15-1252" state="TX" stateName="Texas" startWage={119_642} currentArea="12420" />);
    await waitFor(() => expect(screen.getByText("The stored wage tables couldn't be read just now.")).toBeTruthy());
    expect(screen.queryByLabelText(/Areas of Texas where/)).toBeNull();
  });
});
