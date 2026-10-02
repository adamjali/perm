import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ReviewsLine } from "../ReviewsLine";
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
});
