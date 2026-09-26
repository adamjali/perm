import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/turso/nvcWaitingList", () => ({ getNvcWaitingList: vi.fn() }));
// Reads Turso for the freshness line; not what this file is about.
vi.mock("@/components/data/DataProvenance", () => ({ DataProvenance: () => <div data-testid="provenance" /> }));

import { getNvcWaitingList } from "@/lib/turso/nvcWaitingList";
import type { NvcWaitingListDoc } from "@/lib/nvcWaitingList";
import Page, { metadata } from "../(site)/(public)/nvc-waiting-list/page";
import REAL from "@/lib/__tests__/nvc-waiting-list.fixture.json";

/** The fixture is the real document the ingest built from the seven archived reports (2017-2023). */
async function html() {
  const out = renderToStaticMarkup(await Page());
  return { out, text: out.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ") };
}

beforeEach(() => vi.mocked(getNvcWaitingList).mockResolvedValue(REAL as unknown as NvcWaitingListDoc));

describe("/nvc-waiting-list", () => {
  it("says what the list leaves out before any number", async () => {
    const { text } = await html();
    const caveat = text.indexOf("Consular cases only, families included.");
    expect(caveat).toBeGreaterThan(0);
    expect(caveat).toBeLessThan(text.indexOf("260,660"));
  });

  it("leads with the newest November's totals and the change State prints", async () => {
    const { text } = await html();
    expect(text).toContain("260,660");
    expect(text).toContain("4,034,061");
    expect(text).toMatch(/Nov 1, 2023, \+55% in a year/);
  });

  it("draws every November from 2016 for each employment category", async () => {
    const { out } = await html();
    const titles = [...out.matchAll(/<title>November (\d{4}): /g)].map((m) => m[1]);
    expect(new Set(titles)).toEqual(new Set(["2016", "2017", "2018", "2019", "2020", "2021", "2022", "2023"]));
    expect(out).toContain("November 2023: 44,470 ");
  });

  it("links the report behind each year", async () => {
    const { out } = await html();
    expect((out.match(/href="https:\/\/web\.archive\.org\/web\/\d+\/https:\/\/travel\.state\.gov/g) ?? []).length).toBe(7);
  });

  it("says it hasn't been loaded rather than showing an empty page", async () => {
    vi.mocked(getNvcWaitingList).mockResolvedValue(null);
    const { text } = await html();
    expect(text).toContain("hasn't been loaded yet");
    expect(text).not.toContain("Employment-based, by category");
  });

  it("keeps table cells apart and its title and description inside what search shows", async () => {
    // Tags stripped to NOTHING, as textContent reads them: a space here would hide the glue.
    const { out } = await html();
    expect(out.replace(/<[^>]+>/g, "")).not.toMatch(/\d,\d{3}[+-]\d/);
    expect(`${metadata.title} | PERM Tracker`.length).toBeLessThanOrEqual(60);
    expect(String(metadata.description).length).toBeLessThanOrEqual(155);
  });
});
