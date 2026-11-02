import { describe, expect, it } from "vitest";

import { wordsFirst } from "../rows";

/** Reviews with words go before ratings alone, whatever their age (owner, Nov 2 2026). */
describe("wordsFirst", () => {
  const r = (id: string, text: string) => ({ id, text });

  it("puts every review with words ahead of the ratings alone, keeping newest first within each", () => {
    const newestFirst = [r("a", ""), r("b", "Useful"), r("c", "  "), r("d", "Fast alerts"), r("e", "")];
    expect(wordsFirst(newestFirst).map((x) => x.id)).toEqual(["b", "d", "a", "c", "e"]);
  });

  it("so the homepage's three never show a rating alone while an older review with words waits", () => {
    const newestFirst = [r("rating", ""), r("new", "Great"), r("older", "Helped me find my number")];
    expect(wordsFirst(newestFirst).slice(0, 2).map((x) => x.id)).toEqual(["new", "older"]);
  });

  it("leaves the list it's given alone", () => {
    const list = [r("a", ""), r("b", "Words")];
    wordsFirst(list);
    expect(list.map((x) => x.id)).toEqual(["a", "b"]);
  });
});
