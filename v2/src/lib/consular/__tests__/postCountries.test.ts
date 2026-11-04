import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { POST_COUNTRY, postCountry } from "../postCountries";
import { postSlug } from "../scheduling";

/** The posts State's IV Scheduling Status Tool listed on its Oct 7 2026 update. */
function toolPosts(): string[] {
  const text = readFileSync(join("scripts", "__fixtures__", "iv-tool-2026-10-07.txt"), "utf8");
  return [
    ...new Set(
      text
        .split("\n")
        .slice(2)
        .map((l) => l.split("|")[0]!.trim())
        .filter((p) => p && p !== "null"),
    ),
  ];
}

describe("the country of each immigrant visa post", () => {
  it("names one for every post on State's tool, and lists no post the tool doesn't have", () => {
    // Arrange
    const slugs = toolPosts().map(postSlug);
    // Act
    const missing = slugs.filter((s) => !POST_COUNTRY[s]);
    const extra = Object.keys(POST_COUNTRY).filter((k) => !slugs.includes(k));
    // Assert
    expect(slugs.length).toBeGreaterThan(130);
    expect(missing).toEqual([]);
    expect(extra).toEqual([]);
  });

  it("shows the first name of a country that goes by two", () => {
    // Arrange, Act, Assert
    expect(postCountry("rangoon")).toBe("Burma");
    expect(postCountry("mumbai")).toBe("India");
    expect(postCountry("nowhere")).toBeNull();
  });
});
