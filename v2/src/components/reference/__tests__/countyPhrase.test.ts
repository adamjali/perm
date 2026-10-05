import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/turso/reference", () => ({}));

const { countyPhrase } = await import("../CityReference");

describe("countyPhrase", () => {
  it("names a city's counties the way people say them", () => {
    expect(countyPhrase(["Bronx County", "Kings County", "New York County"])).toBe("Bronx, Kings and New York counties");
    expect(countyPhrase(["Bronx County", "Kings County"])).toBe("Bronx and Kings counties");
  });

  it("keeps full names when they aren't all counties", () => {
    expect(countyPhrase(["St. Louis city", "St. Louis County"])).toBe("St. Louis city and St. Louis County");
    expect(countyPhrase(["Orleans Parish", "Jefferson Parish"])).toBe("Orleans Parish and Jefferson Parish");
  });
});

describe("countWord", () => {
  it("spells out counts under ten", async () => {
    const { countWord } = await import("../CityReference");
    expect(countWord(5)).toBe("five");
    expect(countWord(12)).toBe("12");
  });
});
