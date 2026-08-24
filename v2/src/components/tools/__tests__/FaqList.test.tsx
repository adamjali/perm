import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../../../test-utils/render-utils";
import { FaqList } from "../FaqList";

const ITEMS = [
  { q: "How accurate is the estimate?", a: "It is a forecast over a queue." },
  { q: "Why more than one number?", a: "They measure different things." },
  { q: "Is DOL strictly first in first out?", a: "Broadly, but not strictly." },
];

describe("FaqList", () => {
  it("renders every question", () => {
    renderWithProviders(<FaqList items={ITEMS} />);
    for (const { q } of ITEMS) {
      expect(screen.getByText(q)).toBeInTheDocument();
    }
  });

  it("keeps every answer in the DOM whether open or shut", () => {
    // Each page emits FAQPage structured data. If a collapsed answer were
    // removed from the DOM, the markup and the schema would disagree, and the
    // schema is the half Google reads.
    renderWithProviders(<FaqList items={ITEMS} openFirst />);
    for (const { a } of ITEMS) {
      expect(screen.getByText(a)).toBeInTheDocument();
    }
  });

  it("opens the first answer so the band is not a row of shut doors", () => {
    const { container } = renderWithProviders(<FaqList items={ITEMS} openFirst />);
    const details = container.querySelectorAll("details");
    expect(details[0]).toHaveAttribute("open");
    expect(details[1]).not.toHaveAttribute("open");
  });

  it("can start fully collapsed", () => {
    const { container } = renderWithProviders(<FaqList items={ITEMS} openFirst={false} />);
    expect([...container.querySelectorAll("details")].some((d) => d.hasAttribute("open"))).toBe(
      false,
    );
  });

  it("uses a summary element, so it is keyboard operable without any JS", () => {
    // The reason for native <details>: focus, Enter and Space are handled by
    // the browser, and it still works with scripting disabled.
    const { container } = renderWithProviders(<FaqList items={ITEMS} />);
    const summaries = container.querySelectorAll("details > summary");
    expect(summaries).toHaveLength(ITEMS.length);
  });

  it("gives each summary a 44px tap target", () => {
    const { container } = renderWithProviders(<FaqList items={ITEMS} />);
    for (const s of container.querySelectorAll("summary")) {
      expect(s.className).toContain("min-h-[44px]");
    }
  });

  it("separates the question text from the chevron", () => {
    // Adjacent JSX with no separator extracts as one word.
    const { container } = renderWithProviders(<FaqList items={ITEMS} />);
    const text = container.querySelector("summary")!.textContent ?? "";
    expect(text.trim()).toBe(ITEMS[0]!.q);
  });
});
