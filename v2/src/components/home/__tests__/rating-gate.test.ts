import { readFileSync } from "node:fs";
import { join } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ReviewsLine, starFills } from "../ReviewsLine";
import { REVIEW_URL } from "@/lib/constants/externalLinks";
import { APP_RATING, MIN_REVIEWS_TO_ADVERTISE, shouldAdvertiseRating } from "@/lib/structuredData";

// Only the gate is swapped; APP_RATING and the threshold stay real, because
// the first assertion is about their live values.
const mockAdvertise = vi.fn(() => true);
vi.mock("@/lib/structuredData", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/structuredData")>();
  return { ...actual, shouldAdvertiseRating: () => mockAdvertise() };
});

beforeEach(() => {
  mockAdvertise.mockReturnValue(true);
});

const render = () => renderToStaticMarkup(React.createElement(ReviewsLine));

/**
 * The visible rating and the homepage's aggregateRating markup share one
 * threshold. Google requires a rating in structured data to be visible on the
 * page, so the two must appear and disappear together.
 */
describe("the review rating", () => {
  it("is at or above the advertising floor today, so the branch below is the live one", () => {
    expect(Number(APP_RATING.count)).toBeGreaterThanOrEqual(MIN_REVIEWS_TO_ADVERTISE);
    expect(shouldAdvertiseRating()).toBe(true);
  });

  it("shows the rating when the gate is open", () => {
    const html = render();
    expect(html).toContain(Number(APP_RATING.value).toFixed(1));
    expect(html).toContain(`from ${APP_RATING.count} reviews`);
  });

  it("withholds the rating below the floor, and keeps the review link", () => {
    mockAdvertise.mockReturnValue(false);
    const html = render();
    expect(html).not.toContain("from ");
    expect(html).toContain(REVIEW_URL);
  });

  it("loads nothing from a third party", () => {
    expect(render()).not.toMatch(/<script/);
  });

  it("shows the rating it's given and the newest reviews under it", () => {
    const reviews = [
      { id: "a", rating: 5, text: "Alerts came fast.", name: "Pat", date: "2026-10-23 21:00:00+00" },
      { id: "b", rating: 4, text: "Good tool.", name: "Sam", date: "2026-10-22 21:00:00+00" },
    ];
    const html = renderToStaticMarkup(
      React.createElement(ReviewsLine, { rating: { value: "4.5", count: "2", best: "5", worst: "1" }, reviews }),
    );
    expect(html).toContain("4.5");
    expect(html).toContain("from 2 reviews");
    expect(html).toContain("Alerts came fast.");
    expect(html).toContain("Pat, 5 of 5 stars");
    expect(html.indexOf("Alerts came fast.")).toBeLessThan(html.indexOf("Good tool."));
  });

  it("shows no reviews when the rating is withheld", () => {
    mockAdvertise.mockReturnValue(false);
    const html = renderToStaticMarkup(
      React.createElement(ReviewsLine, {
        rating: { value: "5.0", count: "1", best: "5", worst: "1" },
        reviews: [{ id: "a", rating: 5, text: "Alerts came fast.", name: "Pat", date: "2026-10-23 21:00:00+00" }],
      }),
    );
    expect(html).not.toContain("Alerts came fast.");
  });

  it("the homepage gives the visible line and the structured data the same rating", () => {
    const page = readFileSync(join(__dirname, "..", "..", "..", "app", "(site)", "(public)", "page.tsx"), "utf8");
    expect(page).toMatch(/getHomepageRatingPartialSchema\(baseUrl, siteReviews\.rating\)/);
    expect(page).toMatch(/shouldAdvertiseRating\(siteReviews\.rating\.count\)/);
    expect(page).toMatch(/rating=\{siteReviews\.rating\} reviews=\{siteReviews\.reviews\}/);
  });
});

describe("the stars", () => {
  it("follow the rating to the nearest half", () => {
    expect(starFills(5)).toEqual(["full", "full", "full", "full", "full"]);
    expect(starFills(4.7)).toEqual(["full", "full", "full", "full", "half"]);
    expect(starFills(4.2)).toEqual(["full", "full", "full", "full", "empty"]);
    expect(starFills(4.8)).toEqual(["full", "full", "full", "full", "full"]);
  });
});
