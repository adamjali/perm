// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { usePublishBottomBar } from "../usePublishBottomBar";

// No layout engine here, so each bar reports the height it is given.
function Bar({ height, active = true }: { height: number; active?: boolean }) {
  const ref = usePublishBottomBar<HTMLDivElement>(active);
  return active ? (
    <div
      ref={(el) => {
        if (el) vi.spyOn(el, "getBoundingClientRect").mockReturnValue({ height } as DOMRect);
        ref.current = el;
      }}
    />
  ) : null;
}

const published = () => document.documentElement.style.getPropertyValue("--bottom-bar-h");

afterEach(() => {
  cleanup();
  document.documentElement.style.removeProperty("--bottom-bar-h");
});

describe("usePublishBottomBar", () => {
  it("publishes the bar's height and removes it on unmount", () => {
    const { unmount } = render(<Bar height={76} />);
    expect(published()).toBe("76px");
    unmount();
    expect(published()).toBe("");
  });

  it("holds the tallest of two bars, and the other when one goes", () => {
    const one = render(<Bar height={76} />);
    const two = render(<Bar height={140} />);
    expect(published()).toBe("140px");
    two.unmount();
    expect(published()).toBe("76px");
    one.unmount();
    expect(published()).toBe("");
  });

  it("follows a bar that renders only some of the time", () => {
    const { rerender } = render(<Bar height={120} active={false} />);
    expect(published()).toBe("");
    rerender(<Bar height={120} active />);
    expect(published()).toBe("120px");
    rerender(<Bar height={120} active={false} />);
    expect(published()).toBe("");
  });
});
