import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DRIFT_FROM, IN_ROWS_MAX, dealRows, rowsFor } from "@/lib/reviews/rows";

import { ReviewCarousel, type CarouselReview } from "../ReviewCarousel";

const review = (i: number): CarouselReview => ({ id: `r${i}`, rating: 5 - (i % 3), text: `Review number ${i}.`, name: `Person ${i}`, day: "October 23, 2026" });
const many = (n: number) => Array.from({ length: n }, (_, i) => review(i));
const originalMatchMedia = window.matchMedia;

function reducedMotion(on: boolean) {
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({
    matches: on && q.includes("reduce"),
    media: q,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

afterEach(() => {
  window.matchMedia = originalMatchMedia;
});

describe("the rows", () => {
  it("add a second row at 12 reviews and a third at 24, never a fourth", () => {
    expect([0, 1, 11, 12, 23, 24, 36, 500].map(rowsFor)).toEqual([1, 1, 1, 2, 2, 3, 3, 3]);
  });

  it("deal newest first in turn, so every row opens with a recent review and none is short by more than one", () => {
    const rows = dealRows([0, 1, 2, 3, 4, 5, 6], 3);
    expect(rows).toEqual([[0, 3, 6], [1, 4], [2, 5]]);
  });
});

describe("ReviewCarousel", () => {
  it("sits still with a few reviews: each card once, no copy, no Pause", () => {
    reducedMotion(false);
    render(<ReviewCarousel reviews={[review(1), review(2)]} />);
    expect(screen.getAllByText(/Review number/)).toHaveLength(2);
    expect(screen.queryByRole("button", { name: /Pause|Play/ })).toBeNull();
  });

  it(`drifts from ${DRIFT_FROM}: a hidden, inert copy for the loop, and a Pause button that says it's pressed`, () => {
    reducedMotion(false);
    const { container } = render(<ReviewCarousel reviews={many(DRIFT_FROM)} />);
    // Every review once to assistive tech; the loop's copy is hidden and inert.
    expect(screen.getAllByRole("figure")).toHaveLength(DRIFT_FROM);
    expect(container.querySelectorAll('figure[aria-hidden="true"]')).toHaveLength(DRIFT_FROM);
    const pause = screen.getByRole("button", { name: "Pause" });
    fireEvent.click(pause);
    expect(screen.getByRole("button", { name: "Play" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("grows to three rows and holds only the newest it caps at, each review once", () => {
    reducedMotion(false);
    render(<ReviewCarousel reviews={many(IN_ROWS_MAX + 9)} />);
    expect(screen.getAllByRole("group", { name: /Reviews, row \d of 3/ })).toHaveLength(3);
    const seen = screen.getAllByRole("figure").map((f) => f.textContent ?? "");
    expect(seen).toHaveLength(IN_ROWS_MAX);
    // The newest review is in; the first one past the cap is left for the full list.
    expect(seen.some((t) => t.includes("Review number 0."))).toBe(true);
    expect(seen.some((t) => t.includes(`Review number ${IN_ROWS_MAX}.`))).toBe(false);
    // One Pause for every row (WCAG 2.2.2), not one per row.
    expect(screen.getAllByRole("button", { name: "Pause" })).toHaveLength(1);
  });

  it("never drifts for someone who asks for reduced motion, and still offers Back and Next", () => {
    reducedMotion(true);
    render(<ReviewCarousel reviews={many(DRIFT_FROM + 2)} />);
    expect(screen.queryByRole("button", { name: /Pause|Play/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Next review" })).toBeTruthy();
  });

  it("is a named region whose rows a keyboard can reach", () => {
    reducedMotion(false);
    render(<ReviewCarousel reviews={[review(1)]} />);
    expect(screen.getByRole("region", { name: "Reviews of PERM Tracker" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Reviews, newest first" }).getAttribute("tabindex")).toBe("0");
  });
});
