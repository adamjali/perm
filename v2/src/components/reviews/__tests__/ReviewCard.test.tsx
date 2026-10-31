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

  it("keeps a reviewer's words out of the page's search snippet", () => {
    const { container } = render(<ReviewCard review={{ ...review, text: "Short." }} />);
    expect(container.querySelector("blockquote")?.hasAttribute("data-nosnippet")).toBe(true);
  });

  it("says a rating left without words, with no empty quote", () => {
    const { container } = render(<ReviewCard review={{ ...review, text: "" }} />);
    expect(screen.getByText("Rated without words.")).toBeTruthy();
    expect(container.querySelector("blockquote")).toBeNull();
  });

  it("says a rating came from an alert email, under the reader's placeholder name", () => {
    render(<ReviewCard review={{ id: "a", rating: 5, text: "", name: "Case alert reader", day: "October 2026", viaAlert: true }} />);
    expect(screen.getByText("Case alert reader")).toBeTruthy();
    expect(screen.getByText("Rated from an alert email")).toBeTruthy();
    expect(screen.getByText("October 2026")).toBeTruthy();
    expect(screen.getByText("Rated without words.")).toBeTruthy();
  });

  it("says nothing of the kind on a written review", () => {
    render(<ReviewCard review={{ ...review, text: "Short." }} />);
    expect(screen.queryByText("Rated from an alert email")).toBeNull();
  });
});
