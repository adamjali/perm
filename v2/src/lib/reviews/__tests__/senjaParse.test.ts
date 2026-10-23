import { describe, expect, it } from "vitest";

import { INSIDER_REVIEW_IDS, outsideReviews, parseSenjaWidget, ratingOf } from "../senjaParse";

const [INSIDER] = [...INSIDER_REVIEW_IDS];

/** A widget script shaped like Senja's: code around one inline array of reviews. Names and text are made up. */
function widget(reviews: unknown[]): string {
  return `(()=>{var a={"theme":"light"};const t=${JSON.stringify(reviews)};render(t,[1,2],{"x":"]"});})();`;
}

const review = (id: string, rating: number, date: string, text = "Useful.", name = "Pat") => ({
  id,
  rating,
  text,
  date,
  type: "text",
  customer: { id: `c-${id}`, name },
});

describe("reading Senja's widget script", () => {
  it("finds the review array, decodes Senja's HTML entities and keeps each field", () => {
    const js = widget([review("r1", 5, "2026-10-23 21:00:32.914+00", "RFI -&gt; Analyst Review -&gt; Certified")]);
    expect(parseSenjaWidget(js)).toEqual([
      { id: "r1", rating: 5, text: "RFI -> Analyst Review -> Certified", name: "Pat", date: "2026-10-23 21:00:32.914+00" },
    ]);
  });

  it("isn't thrown by brackets inside a review's text", () => {
    const js = widget([review("r1", 4, "2026-10-22 23:39:44+00", "Good [really] good } tool ]")]);
    expect(parseSenjaWidget(js)?.[0]?.text).toBe("Good [really] good } tool ]");
  });

  it("drops a malformed review and keeps the rest", () => {
    const js = widget([review("r1", 5, "2026-10-23 21:00:00+00"), review("r2", 9, "2026-10-23 21:00:00+00"), { id: "r3" }]);
    expect(parseSenjaWidget(js)?.map((r) => r.id)).toEqual(["r1"]);
  });

  it("reads a changed format as unreadable, never as no reviews", () => {
    expect(parseSenjaWidget("(()=>{const t=[];})();")).toBeNull();
    expect(parseSenjaWidget("")).toBeNull();
  });
});

describe("which reviews count", () => {
  it("leaves out the insiders' reviews and puts the newest first", () => {
    const all = parseSenjaWidget(
      widget([
        review("old", 4, "2026-10-22 23:39:44+00"),
        review(INSIDER!, 5, "2026-02-07 01:44:27+00"),
        review("new", 5, "2026-10-23 21:00:32+00"),
      ]),
    )!;
    expect(outsideReviews(all).map((r) => r.id)).toEqual(["new", "old"]);
  });

  it("rates them to one decimal, as strings", () => {
    const all = parseSenjaWidget(widget([review("a", 5, "2026-10-23 21:00:00+00"), review("b", 4, "2026-10-22 21:00:00+00")]))!;
    expect(ratingOf(all)).toEqual({ value: "4.5", count: "2", best: "5", worst: "1" });
    expect(ratingOf([])).toEqual({ value: "0.0", count: "0", best: "5", worst: "1" });
  });
});
