import { describe, expect, it } from "vitest";

import { getI140ProcessingTime, PROCESSING_TIMES_AS_OF } from "@/lib/processing-times/i140ProcessingTimes";
import { h4EadTimes, i140Code, i140Figures, i140Series, isCurrent, parseUscisPosted } from "@/lib/uscisPosted";

/** USCIS's posted figures take the place of the typed ones only while they're current, code by code. */

const doc = (published: string, e21: number | null, extra: object = {}) =>
  JSON.stringify({
    published,
    postings: ["2026-08-15", "2026-09-26", published],
    longestGapDays: 40,
    project: "https://github.com/jzebedee/uscis",
    newest: [
      { form: "I-140", subtype: "136A-E21", office: "SCD", posted: e21, postedText: e21 === null ? "See notes" : `${e21} Months`, requestDate: "2026-04-19" },
      { form: "I-140", subtype: "136A-E11", office: "SCD", posted: 34, postedText: "34 Months", requestDate: null },
      { form: "I-485", subtype: "131A", office: "FOD", posted: 9.5, postedText: "9.5 Months", requestDate: null },
    ],
    series: [
      { form: "I-140", subtype: "136A-E21", office: "SCD", points: [["2026-08-15", 4], ["2026-09-26", 3.5], [published, 3]] },
      { form: "I-140", subtype: "136A-E31", office: "SCD", points: [["2026-08-15", 4]] },
      { form: "I-140", subtype: "136A-E11", office: "NSC", points: [["2022-03-14", 9], ["2022-04-01", 10]] },
    ],
    ...extra,
  });

const typedE21 = getI140ProcessingTime("EB-2")!.subtypes[0]!.months80;

describe("parseUscisPosted", () => {
  it("reads the doc the loader writes", () => {
    const d = parseUscisPosted(doc("2026-10-19", 2.5))!;
    expect(d.published).toBe("2026-10-19");
    expect(d.newest).toHaveLength(3);
    expect(d.series[0]?.points).toEqual([["2026-08-15", 4], ["2026-09-26", 3.5], ["2026-10-19", 3]]);
  });

  it("refuses a doc with no posting date, and garbage", () => {
    expect(parseUscisPosted(JSON.stringify({ newest: [] }))).toBeNull();
    expect(parseUscisPosted("not json")).toBeNull();
  });
});

describe("i140Figures", () => {
  it("takes USCIS's newest posting while it's current, with USCIS's date", () => {
    const f = i140Figures(parseUscisPosted(doc("2026-10-19", 2.5)), "2026-10-31");
    expect(f.from).toBe("posted");
    expect(f.asOf).toBe("2026-10-19");
    expect(f.subtypes.find((s) => s.code === "E21")?.months80).toBe(2.5);
    expect(f.subtypes.find((s) => s.code === "E11")?.months80).toBe(34);
  });

  it("keeps the typed figure for a code the posting lacks or prints only a note for", () => {
    const f = i140Figures(parseUscisPosted(doc("2026-10-19", null)), "2026-10-31");
    expect(f.subtypes.find((s) => s.code === "E21")?.months80).toBe(typedE21);
    const typedNiw = getI140ProcessingTime("EB-2-NIW")!.subtypes[0]!.months80;
    expect(f.subtypes.find((s) => s.code === "NIW")?.months80).toBe(typedNiw);
  });

  it("falls back to the typed figures, dated when read, once the posting is past USCIS's longest gap with room", () => {
    const stale = parseUscisPosted(doc("2026-06-01", 2.5))!;
    expect(isCurrent(stale, "2026-10-31")).toBe(false);
    const f = i140Figures(stale, "2026-10-31");
    expect(f.from).toBe("read");
    expect(f.asOf).toBe(PROCESSING_TIMES_AS_OF);
    expect(f.subtypes.find((s) => s.code === "E21")?.months80).toBe(typedE21);
    expect(i140Figures(null, "2026-10-31").from).toBe("read");
  });

  it("never reads another office's line as the I-140's", () => {
    const d = parseUscisPosted(doc("2026-10-19", 2.5))!;
    expect(i140Figures({ ...d, newest: d.newest.map((r) => ({ ...r, office: "NSC" })) }, "2026-10-31").from).toBe("read");
  });
});

describe("i140Series", () => {
  it("draws each subtype at Service Center Operations with two or more postings, in the typed order", () => {
    const s = i140Series(parseUscisPosted(doc("2026-10-19", 2.5)));
    expect(s.map((x) => x.code)).toEqual(["E21"]);
    expect(s[0]?.name).toBe(getI140ProcessingTime("EB-2")!.subtypes[0]!.label);
  });

  it("reads a subtype's code from USCIS's key", () => {
    expect(i140Code("136A-NIW")).toBe("NIW");
    expect(i140Code("136A-E31")).toBe("E31");
  });
});

describe("h4EadTimes: the H-4 work permit's two posted routes", () => {
  const withH4 = (published: string, rows: object[]) =>
    parseUscisPosted(doc(published, 3, { newest: [...(JSON.parse(doc(published, 3)).newest as object[]), ...rows] }));
  const both = [
    { form: "I-765", subtype: "147-539C26", office: "SCD", posted: 6.5, postedText: "6.5 Months", requestDate: null },
    { form: "I-765", subtype: "147-C26", office: "SCD", posted: 17.5, postedText: "17.5 Months", requestDate: null },
  ];

  it("names both routes, filed with the H-4 extension first, in months as USCIS posted them", () => {
    expect(h4EadTimes(withH4("2026-10-19", both), "2026-11-04")).toEqual({
      published: "2026-10-19",
      rows: [
        { key: "with-i539", name: "Filed with the H-4 extension (I-539)", months: 6.5, text: "6.5 months" },
        { key: "alone", name: "Filed on its own", months: 17.5, text: "17.5 months" },
      ],
    });
  });

  it("says nothing when a route is missing, a figure is a note, or the posting has gone stale", () => {
    expect(h4EadTimes(withH4("2026-10-19", both.slice(0, 1)), "2026-11-04")).toBeNull();
    expect(h4EadTimes(withH4("2026-10-19", [both[0]!, { ...both[1]!, posted: null }]), "2026-11-04")).toBeNull();
    expect(h4EadTimes(withH4("2026-06-01", both), "2026-11-04")).toBeNull();
    expect(h4EadTimes(null, "2026-11-04")).toBeNull();
  });
});
