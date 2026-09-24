import { render } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useLabelSenjaAttribution } from "../TestimonialsSection";

/**
 * Senja's "powered by" link is icon-only, so the section labels it after the
 * widget renders. The widget is LAZY: it renders when the section scrolls into
 * view, which can be long after mount. The hook used to stop watching after 20
 * seconds, and an outside Lighthouse run on 2026-09-23 still found the link
 * unnamed. This arranges exactly that: the link arrives 25 seconds late.
 */
function Harness() {
  const ref = useRef<HTMLDivElement>(null);
  useLabelSenjaAttribution(ref);
  return (
    <div ref={ref}>
      <div className="senja-embed" />
    </div>
  );
}

afterEach(() => vi.useRealTimers());

describe("useLabelSenjaAttribution", () => {
  it("names the link even when the lazy widget renders long after mount", async () => {
    vi.useFakeTimers();
    const { container } = render(<Harness />);
    vi.advanceTimersByTime(25_000);
    vi.useRealTimers();

    const avatars = document.createElement("div");
    avatars.className = "sj-avatars";
    const link = document.createElement("a");
    link.className = "sj-powered-by";
    link.href = "https://senja.io";
    avatars.appendChild(link);
    container.querySelector(".senja-embed")!.appendChild(avatars);
    await new Promise((r) => setTimeout(r, 0));

    expect(link.getAttribute("aria-label")).toBe("Reviews powered by Senja");
  });

  it("never overwrites a name the widget already carries", async () => {
    const { container } = render(<Harness />);
    const link = document.createElement("a");
    link.className = "sj-powered-by";
    link.textContent = "Powered by Senja";
    container.querySelector(".senja-embed")!.appendChild(link);
    await new Promise((r) => setTimeout(r, 0));
    expect(link.getAttribute("aria-label")).toBeNull();
  });
});
