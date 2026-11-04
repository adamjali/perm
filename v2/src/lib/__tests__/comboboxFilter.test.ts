import { describe, expect, it } from "vitest";

import { filterOptions, foldText, nextActive } from "../comboboxFilter";

const OPTIONS = [
  { value: "Software Developers", label: "Software Developers (412)" },
  { value: "Computer Systems Analysts", label: "Computer Systems Analysts (88)" },
  { value: "Data Scientists", label: "Data Scientists (61)" },
  { value: "Developers, Web", label: "Developers, Web (12)" },
  { value: "Accountants and Auditors", label: "Accountants and Auditors (9)" },
];

describe("foldText", () => {
  it("drops case and accents so a reader needn't type either", () => {
    // Arrange, Act, Assert
    expect(foldText("São Paulo")).toBe("sao paulo");
    expect(foldText("  MÉXICO ")).toBe("mexico");
  });
});

describe("filterOptions", () => {
  it("keeps every option, in its own order, for an empty search", () => {
    // Arrange, Act
    const got = filterOptions(OPTIONS, "  ");
    // Assert
    expect(got.map((o) => o.value)).toEqual(OPTIONS.map((o) => o.value));
  });

  it("puts a name that starts with the search first, then a word that does, then anything holding it", () => {
    // Arrange, Act
    const got = filterOptions(OPTIONS, "dev");
    // Assert
    expect(got.map((o) => o.value)).toEqual(["Developers, Web", "Software Developers"]);
  });

  it("needs every word typed, in any order", () => {
    // Arrange, Act
    const got = filterOptions(OPTIONS, "analysts systems");
    // Assert
    expect(got.map((o) => o.value)).toEqual(["Computer Systems Analysts"]);
  });

  it("matches the words an option carries beside its label", () => {
    // Arrange
    const posts = [
      { value: "mumbai", label: "Mumbai", keywords: "India" },
      { value: "chennai", label: "Chennai", keywords: "India" },
      { value: "toronto", label: "Toronto", keywords: "Canada" },
    ];
    // Act
    const got = filterOptions(posts, "india");
    // Assert
    expect(got.map((o) => o.value)).toEqual(["mumbai", "chennai"]);
  });

  it("finds nothing for a search nothing holds", () => {
    // Arrange, Act, Assert
    expect(filterOptions(OPTIONS, "zzz")).toEqual([]);
  });
});

describe("nextActive", () => {
  it("moves down and up, stopping at the ends", () => {
    // Arrange, Act, Assert
    expect(nextActive("ArrowDown", 0, 3)).toBe(1);
    expect(nextActive("ArrowDown", 2, 3)).toBe(2);
    expect(nextActive("ArrowUp", 0, 3)).toBe(0);
    expect(nextActive("ArrowUp", 2, 3)).toBe(1);
  });

  it("starts at the first row when nothing is active yet", () => {
    // Arrange, Act, Assert
    expect(nextActive("ArrowDown", -1, 3)).toBe(0);
    expect(nextActive("ArrowUp", -1, 3)).toBe(0);
  });

  it("jumps to the ends and by pages", () => {
    // Arrange, Act, Assert
    expect(nextActive("Home", 5, 30)).toBe(0);
    expect(nextActive("End", 5, 30)).toBe(29);
    expect(nextActive("PageDown", 5, 30)).toBe(15);
    expect(nextActive("PageDown", 25, 30)).toBe(29);
    expect(nextActive("PageUp", 5, 30)).toBe(0);
  });

  it("has no row to move to in an empty list, and ignores other keys", () => {
    // Arrange, Act, Assert
    expect(nextActive("ArrowDown", -1, 0)).toBe(-1);
    expect(nextActive("a", 2, 3)).toBeNull();
  });
});
