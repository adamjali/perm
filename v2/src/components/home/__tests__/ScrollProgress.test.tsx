// @vitest-environment jsdom
import { Profiler } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, fireEvent } from "@testing-library/react";
import { ScrollProgress } from "../ScrollProgress";

// The bar sits in the public layout, so it is on screen during every scroll,
// including the burst of scrolling Next does when someone presses Back several
// times quickly. A React update per animation frame there was one of the updates
// that tripped "Maximum update depth exceeded" (#185) in production (Oct 12 2026).
// The bar is drawn straight onto its element instead, so scrolling commits nothing.

function setPage(scrollTop: number, scrollHeight: number, innerHeight: number) {
  Object.defineProperty(document.documentElement, "scrollTop", { value: scrollTop, configurable: true });
  Object.defineProperty(document.documentElement, "scrollHeight", { value: scrollHeight, configurable: true });
  Object.defineProperty(window, "innerHeight", { value: innerHeight, configurable: true });
}

// Frames are queued and run by `frame()`, as a browser runs them after the event.
let frames: FrameRequestCallback[] = [];
// Inside act, so any React update a frame makes is committed before the test
// counts commits (outside act it would still be pending and the count would lie).
function frame() {
  const due = frames;
  frames = [];
  act(() => {
    for (const cb of due) cb(0);
  });
}
function scrollTo(top: number, height = 2000, viewport = 1000) {
  setPage(top, height, viewport);
  fireEvent.scroll(window);
  frame();
}

describe("ScrollProgress", () => {
  beforeEach(() => {
    frames = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb: FrameRequestCallback) => {
      frames.push(cb);
      return frames.length;
    });
    setPage(0, 2000, 1000);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const bar = () => document.querySelector(".scroll-progress") as HTMLElement;

  it("draws how far the reader has scrolled", () => {
    render(<ScrollProgress />);
    scrollTo(500);
    expect(bar().style.transform).toBe("scaleX(0.5)");
    scrollTo(1000);
    expect(bar().style.transform).toBe("scaleX(1)");
  });

  it("starts where the page already is (a page restored by Back keeps its scroll)", () => {
    setPage(250, 2000, 1000);
    render(<ScrollProgress />);
    expect(bar().style.transform).toBe("scaleX(0.25)");
  });

  it("commits nothing to React while the reader scrolls", () => {
    const commits = vi.fn();
    render(
      <Profiler id="bar" onRender={commits}>
        <ScrollProgress />
      </Profiler>,
    );
    const afterMount = commits.mock.calls.length;
    for (const top of [100, 300, 600, 900, 1000]) scrollTo(top);
    expect(bar().style.transform).toBe("scaleX(1)");
    expect(commits.mock.calls.length).toBe(afterMount);
  });

  it("draws an empty bar on a page too short to scroll", () => {
    setPage(0, 800, 1000);
    render(<ScrollProgress />);
    scrollTo(0, 800, 1000);
    expect(bar().style.transform).toBe("scaleX(0)");
  });
});
