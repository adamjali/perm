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
const { boardRowsFor } = await import("../HeroSection");
const { RoadSection } = await import("../RoadSection");
const { ExplainerFilm } = await import("../ExplainerFilm");
const { FILM_ATTORNEYS, FILM_WAITING } = await import("@/lib/constants/films");

const PUBLIC = join(process.cwd(), "public");

function textOf(html: string): string {
  const el = document.createElement("div");
  el.innerHTML = html;
  return el.textContent ?? "";
}

describe("the figures at DOL beside the lookup", () => {
  const board = { frontierMonth: "2025-12-01", lastDay: { date: "2026-10-05", total: 552 }, pending: 91933, checkedAt: null };
  const html = renderToStaticMarkup(<HeroSection board={board} />);

  it("puts each value in the page text exactly once", () => {
    const text = textOf(html);
    expect(text.match(/Dec 2025/g)).toHaveLength(1);
    expect(text.match(/91,933/g)).toHaveLength(1);
  });

  it("drops a row whose figure is missing, and never invents one", () => {
    expect(boardRowsFor(undefined)).toEqual([]);
    const rows = boardRowsFor({ frontierMonth: null, lastDay: null, pending: 91933, checkedAt: null, pwdPending: null });
    expect(rows).toEqual([{ label: "PERMs pending", value: "91,933" }]);
  });

  it("names the day by its date, never a weekday that reads as a month", () => {
    const rows = boardRowsFor({
      frontierMonth: "2025-12-01",
      lastDay: { date: "2026-09-30", total: 901 },
      pending: 91933,
      checkedAt: null,
      pwdPending: 47941,
    });
    expect(rows.map((r) => `${r.label}=${r.value}`)).toEqual([
      "Now deciding cases filed in=Dec 2025",
      "Cases decided on Sep 30=901",
      "PERMs pending=91,933",
      "Wage requests pending=47,941",
    ]);
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
