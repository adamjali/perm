import { readFileSync } from "node:fs";
import { join } from "node:path";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { webpSize } from "../../../../test-utils/image-size";

vi.mock("next/image", () => ({
  default: (p: { src: string; alt: string; width: number; height: number; loading?: "lazy" | "eager" }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={p.src} alt={p.alt} width={p.width} height={p.height} loading={p.loading} />
  ),
}));

const { HeroSection } = await import("../HeroSection");
const { heroFigures, monthColumns } = await import("../HeroSection");
const { RoadSection } = await import("../RoadSection");
const { ExplainerFilm } = await import("../ExplainerFilm");
const { FILM_ATTORNEYS, FILM_WAITING } = await import("@/lib/constants/films");

const PUBLIC = join(process.cwd(), "public");

function textOf(html: string): string {
  const el = document.createElement("div");
  el.innerHTML = html;
  return el.textContent ?? "";
}

describe("the answer and the figures at the top of the homepage", () => {
  const board = { frontierMonth: "2025-12-01", lastDay: { date: "2026-10-05", total: 552 }, pending: 91933, checkedAt: null };
  const months = [
    { month: "2025-11", decided: 900, waiting: 100, total: 1000, isFront: false, isPartial: false },
    { month: "2025-12", decided: 300, waiting: 700, total: 1000, isFront: true, isPartial: false },
    { month: "2026-01", decided: 0, waiting: 0, total: 0, isFront: false, isPartial: true },
  ];
  const html = renderToStaticMarkup(<HeroSection board={board} months={months} />);

  it("answers with DOL's month in the H1, and says each figure once", () => {
    const h1 = html.slice(html.indexOf("<h1"), html.indexOf("</h1>"));
    expect(textOf(h1)).toMatch(/DOL is deciding PERM cases filed in\s*December 2025/);
    const text = textOf(html);
    expect(text.match(/91,933/g)).toHaveLength(1);
    expect(text.match(/552/g)).toHaveLength(1);
  });

  it("drops a figure whose value is missing, and never invents one", () => {
    expect(heroFigures(undefined, null)).toEqual([]);
    const rows = heroFigures({ frontierMonth: null, lastDay: null, pending: 91933, checkedAt: null, pwdPending: null }, null);
    expect(rows).toEqual([{ label: "PERM cases waiting", value: "91,933" }]);
  });

  it("the wait is the live reading, dated, never the quarterly file's month (Oct 28 2026)", () => {
    // The hero said "A PERM case takes 13 months" from DOL's June file while DOL was deciding January's
    // cases in October (about 9 months). The figure is /today's: what DOL's last working day's cases waited.
    const html = renderToStaticMarkup(<HeroSection board={board} months={months} wait={{ days: 289, on: "2026-10-27" }} />);
    expect(textOf(html)).toContain("Cases decided Oct 27 waited");
    expect(textOf(html)).toContain("9½ months");
    expect(textOf(html)).not.toContain("13 months");
    expect(heroFigures(board, { days: 0, on: "2026-10-27" }).some((r) => r.label.endsWith("waited"))).toBe(false);
  });

  it("names the day by its date, never a weekday that reads as a month", () => {
    const rows = heroFigures(
      { frontierMonth: "2025-12-01", lastDay: { date: "2026-09-30", total: 901 }, pending: 91933, checkedAt: null, pwdPending: 47941 },
      { days: 289, on: "2026-09-30" },
    );
    expect(rows.map((r) => `${r.label}=${r.value}`)).toEqual([
      "Cases decided Sep 30 waited=9½ months",
      "PERM cases waiting=91,933",
      "Decided on Sep 30=901",
      "Wage requests waiting=47,941",
    ]);
  });

  it("draws one column a month, marks DOL's month, and links only months with cases", () => {
    const cols = monthColumns(months);
    expect(cols.map((c) => c.key)).toEqual(["2025-11", "2025-12", "2026-01"]);
    expect(cols.filter((c) => c.now).map((c) => c.key)).toEqual(["2025-12"]);
    expect(cols[1]!.top).toBe("DOL is here");
    expect(cols[1]!.href).toBe("/perm-queue/2025-12");
    expect(cols[2]!.href).toBeUndefined();
    expect(cols[1]!.tip).toContain("30% decided");
    expect(cols[2]!.tip).toContain("No cases on DOL's record");
  });

  it("draws no chart without months, and keeps the case box", () => {
    const bare = renderToStaticMarkup(<HeroSection board={board} />);
    expect(bare).not.toContain("still waiting");
    expect(bare).toContain("Check a case");
  });
});


describe("RoadSection", () => {
  const html = renderToStaticMarkup(<RoadSection pwdPending={47941} frontierMonth="2025-12-01" />);

  it("shows six stops, each with a real document on disk at the size it declares", () => {
    const imgs = [...html.matchAll(/<img src="([^"]+)" alt="([^"]*)" width="(\d+)" height="(\d+)"/g)];
    expect(imgs).toHaveLength(6);
    for (const [, src, , w, h] of imgs) {
      const size = webpSize(join(PUBLIC, src!));
      expect(size, src).toEqual({ w: Number(w), h: Number(h) });
    }
  });

  it("names every document in its alt text", () => {
    const alts = [...html.matchAll(/<img src="[^"]+" alt="([^"]*)"/g)].map((m) => m[1]);
    expect(alts.filter((a) => a === "")).toHaveLength(0);
    expect(alts.filter(Boolean).every((a) => /Form|bulletin|card/i.test(a!))).toBe(true);
  });

  it("prints the live figures it was given, and drops them when absent", () => {
    expect(textOf(html)).toContain("47,941 requests waiting");
    expect(textOf(html)).toContain("Deciding December 2025 filings");
    const bare = textOf(renderToStaticMarkup(<RoadSection pwdPending={null} frontierMonth={null} />));
    expect(bare).not.toMatch(/requests waiting|Deciding/);
  });
});

describe("ExplainerFilm", () => {
  it.each([FILM_WAITING, FILM_ATTORNEYS])("never downloads the film until asked: $title", (film) => {
    const html = renderToStaticMarkup(<ExplainerFilm film={film} />);
    // Until someone presses play there's no player at all, only the thumbnail.
    expect(html).not.toMatch(/<video|<source/);
    // Below the fold, so the thumbnail loads lazily rather than being preloaded.
    expect(html).not.toContain('rel="preload"');
    expect(html).toContain(film.poster);
    expect(html).toMatch(new RegExp(`aria-label="Play the film: ${film.title}, \\d:\\d{2}"`));
    // ...and search engines are still told the film exists, with its thumbnail.
    expect(html).toContain('"@type":"VideoObject"');
    expect(webpSize(join(PUBLIC, film.poster))).toEqual({ w: 1280, h: 720 });
    expect(readFileSync(join(PUBLIC, film.src)).length).toBeGreaterThan(1_000_000);
    expect(film.transcript.length).toBeGreaterThan(5);
  });
});
