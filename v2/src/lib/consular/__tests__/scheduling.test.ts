import { describe, expect, it } from "vitest";

import { CONSULAR_PAUSE, SEVENTY_FIVE, SEVENTY_FIVE_KEYS, pauseActive } from "../facts";
import { behindLabel, monthsBehind, postName, postSlug } from "../scheduling";

describe("reading State's scheduling month", () => {
  it("counts whole months back from State's own update", () => {
    expect(monthsBehind({ printed: "Mar-2023", month: "2023-03" }, "2026-10-07")).toBe(43);
    expect(monthsBehind({ printed: "Oct-2026", month: "2026-10" }, "2026-10-07")).toBe(0);
  });

  it("shows no number where State shows none", () => {
    expect(monthsBehind({ printed: "N/A", month: null }, "2026-10-07")).toBeNull();
    expect(behindLabel({ printed: "N/A", month: null }, "2026-10-07")).toBe("Not shown");
    expect(behindLabel(null, "2026-10-07")).toBe("Not shown");
  });

  it("says it in words, years once it's two or more", () => {
    expect(behindLabel({ printed: "Oct-2026", month: "2026-10" }, "2026-10-07")).toBe("Caught up");
    expect(behindLabel({ printed: "Sep-2026", month: "2026-09" }, "2026-10-07")).toBe("1 month back");
    expect(behindLabel({ printed: "Feb-2026", month: "2026-02" }, "2026-10-07")).toBe("8 months back");
    expect(behindLabel({ printed: "Mar-2023", month: "2023-03" }, "2026-10-07")).toBe("3.6 years back");
    expect(behindLabel({ printed: "Oct-2024", month: "2024-10" }, "2026-10-07")).toBe("2 years back");
  });
});

describe("a post's page", () => {
  it("names a post the way people do", () => {
    expect(postName("rio de janeiro", "Rio de Janeiro", "Rio De Janeiro")).toBe("Rio de Janeiro");
    expect(postName("mumbai", null, "Mumbai (Bombay)")).toBe("Mumbai");
    expect(postName("ait taipei", "AIT Taipei", "Taipei")).toBe("Taipei");
  });

  it("gives plain addresses", () => {
    expect(postSlug("Ho Chi Minh City")).toBe("ho-chi-minh-city");
    expect(postSlug("Port-au-Prince")).toBe("port-au-prince");
    expect(postSlug("Ciudad Juárez")).toBe("ciudad-juarez");
    expect(postSlug("Mumbai (Bombay)")).toBe("mumbai");
  });
});

describe("the hand-kept facts", () => {
  it("names 75 countries, each once", () => {
    expect(SEVENTY_FIVE.countries).toHaveLength(75);
    expect(SEVENTY_FIVE_KEYS.size).toBe(75);
  });

  it("dates every pause source and says when to check again", () => {
    for (const s of CONSULAR_PAUSE.sources) {
      expect(s.url).toMatch(/^https:\/\//);
      expect(s.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(s.quote).toBeTruthy();
    }
    expect(CONSULAR_PAUSE.recheckBy > CONSULAR_PAUSE.checked).toBe(true);
    expect(pauseActive({ ...CONSULAR_PAUSE, status: "resumed" })).toBe(false);
  });
});
