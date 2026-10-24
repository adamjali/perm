import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ReviewCard } from "../ReviewCard";

const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollHeight");
afterEach(() => {
  if (original) Object.defineProperty(HTMLElement.prototype, "scrollHeight", original);
});

/** happy-dom lays nothing out, so the words' height is set: taller than their box means the clamp cut them. */
function wordsTaller(than: number) {
  Object.defineProperty(HTMLElement.prototype, "scrollHeight", { configurable: true, get: () => than + 50 });
}

const review = { id: "r", rating: 5, text: "Words. ".repeat(200), name: "Pat", day: "October 23, 2026" };

describe("ReviewCard", () => {
  it("offers Read more only when the words were cut, and opens and folds them", () => {
    wordsTaller(0);
    render(<ReviewCard review={review} />);
    const more = screen.getByRole("button", { name: "Read more" });
    expect(more.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(more);
    expect(screen.getByRole("button", { name: "Show less" }).getAttribute("aria-expanded")).toBe("true");
  });

  it("has nothing to press when the whole review fits", () => {
    Object.defineProperty(HTMLElement.prototype, "scrollHeight", { configurable: true, get: () => 0 });
    render(<ReviewCard review={{ ...review, text: "Short." }} />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("says a rating left without words, with no empty quote", () => {
    const { container } = render(<ReviewCard review={{ ...review, text: "" }} />);
    expect(screen.getByText("Rated without words.")).toBeTruthy();
    expect(container.querySelector("blockquote")).toBeNull();
  });
});
