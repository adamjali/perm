import { describe, expect, it } from "vitest";

import {
  RECEIPT_PREFIXES,
  RECEIPT_SHAPE_MESSAGE,
  decodeReceipt,
  looksLikeReceipt,
  normaliseReceipt,
} from "../receipt";

/**
 * The receipt parser is the shape gate in front of a federal endpoint, so it
 * is pinned against the two regexes USCIS publishes rather than against
 * whatever this file happened to accept on the day it was written.
 */
describe("normaliseReceipt", () => {
  it("accepts USCIS's documented shape, upper-cased, separators stripped", () => {
    expect(normaliseReceipt("EAC2190123456")).toBe("EAC2190123456");
    expect(normaliseReceipt(" eac-21-901-23456 ")).toBe("EAC2190123456");
    expect(normaliseReceipt("wac 21 901 23456")).toBe("WAC2190123456");
  });

  it("accepts USCIS's masked form, three letters then * and nine digits", () => {
    expect(normaliseReceipt("EAC*190123456")).toBe("EAC*190123456");
  });

  it("refuses everything that USCIS's 422 would refuse", () => {
    for (const bad of [
      "",
      "EAC219012345", // nine digits
      "EAC21901234567", // eleven
      "EA2190123456", // two letters
      "EACX190123456", // letter in the digits
      "G-100-26125-868956", // a DOL number
      "P-100-26240-200135",
      "Microsoft",
      "EAC**90123456",
    ]) {
      expect(normaliseReceipt(bad), bad).toBeNull();
    }
  });

  it("puts the length cap before any work (a 100k string returns fast)", () => {
    const t0 = performance.now();
    expect(normaliseReceipt("E".repeat(100_000))).toBeNull();
    expect(performance.now() - t0).toBeLessThan(200);
  });
});

describe("decodeReceipt", () => {
  it("names the office for every glossary prefix and labels the digit reading a convention", () => {
    const d = decodeReceipt("EAC2190123456");
    expect(d).not.toBeNull();
    expect(d!.prefix).toBe("EAC");
    expect(d!.office?.name).toBe("Vermont Service Center");
    expect(d!.office?.source).toBe("glossary");
    expect(d!.masked).toBe(false);
    expect(d!.convention).toEqual({ fiscalYear: 2021, workday: 901, sequence: "23456" });
  });

  it("keeps an unknown prefix rather than refusing it, because USCIS's regex accepts any three letters", () => {
    const d = decodeReceipt("ZZZ2190123456");
    expect(d).not.toBeNull();
    expect(d!.office).toBeNull();
  });

  it("gives a masked receipt no convention, because there is nothing to read", () => {
    const d = decodeReceipt("SRC*190123456");
    expect(d!.masked).toBe(true);
    expect(d!.convention).toBeNull();
  });

  it("reads 90-99 as the 1990s and everything else as 2000s", () => {
    expect(decodeReceipt("LIN9912345678")!.convention!.fiscalYear).toBe(1999);
    expect(decodeReceipt("LIN0012345678")!.convention!.fiscalYear).toBe(2000);
    expect(decodeReceipt("LIN2612345678")!.convention!.fiscalYear).toBe(2026);
  });

  it("lists the seven prefixes USCIS's glossary names, sourced to the glossary", () => {
    for (const p of ["EAC", "WAC", "LIN", "SRC", "NBC", "MSC", "IOE"]) {
      expect(RECEIPT_PREFIXES[p]?.source, p).toBe("glossary");
    }
    // YSC is real (Potomac) but not in the glossary's list; it must say so.
    expect(RECEIPT_PREFIXES.YSC?.source).toBe("notices");
  });
});

describe("looksLikeReceipt", () => {
  it("catches a half-typed receipt so the DOL page can point at the right one", () => {
    expect(looksLikeReceipt("EAC2190")).toBe(true);
    expect(looksLikeReceipt("ioe0912345678")).toBe(true);
    expect(looksLikeReceipt("EAC*1234")).toBe(true);
  });

  it("does not catch a DOL number, an employer name or nothing", () => {
    expect(looksLikeReceipt("G-100-26125-868956")).toBe(false);
    expect(looksLikeReceipt("A-23043-00641")).toBe(false);
    expect(looksLikeReceipt("Microsoft")).toBe(false);
    expect(looksLikeReceipt("")).toBe(false);
  });
});

describe("the shape message", () => {
  it("names the shape and where to find it, in one sentence pair", () => {
    expect(RECEIPT_SHAPE_MESSAGE).toMatch(/three letters and ten digits/);
    expect(RECEIPT_SHAPE_MESSAGE).toMatch(/I-797/);
  });
});
