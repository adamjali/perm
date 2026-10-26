import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";

const nav = vi.hoisted(() => ({ pathname: "/cases", push: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ push: nav.push }),
}));

const drive = vi.hoisted(() => ({ configs: [] as Array<{ steps: Array<{ element?: string; popover?: { title?: string } }> }> }));
vi.mock("driver.js", () => ({
  driver: (config: (typeof drive.configs)[number]) => {
    drive.configs.push(config);
    return { drive: vi.fn(), destroy: vi.fn(), moveNext: vi.fn(), hasNextStep: () => false };
  },
}));
vi.mock("driver.js/dist/driver.css", () => ({}));

import { OnboardingTour } from "../OnboardingTour";

/**
 * Oct 26 2026: on an account with no cases, Cases and Calendar showed their empty screens, the tour found no
 * target within 4 seconds and moved on in silence, which looked like the tour advancing by itself.
 */
describe("OnboardingTour", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    drive.configs.length = 0;
  });
  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it("shows the page's step in the middle of the screen when its target never appears, and never skips it", () => {
    nav.pathname = "/cases";
    const onPhaseComplete = vi.fn();
    render(<OnboardingTour active tourPhase="cases" onPhaseComplete={onPhaseComplete} onTourSkip={vi.fn()} />);
    act(() => {
      vi.advanceTimersByTime(4_500);
    });
    expect(drive.configs).toHaveLength(0);
    act(() => {
      vi.advanceTimersByTime(6_000);
    });
    expect(onPhaseComplete).not.toHaveBeenCalled();
    expect(drive.configs).toHaveLength(1);
    const step = drive.configs[0]!.steps[0]!;
    expect(step.element).toBeUndefined();
    expect(step.popover?.title).toBe("Your case list");
  });

  it("points at the page's target when it's there", () => {
    nav.pathname = "/calendar";
    const target = document.createElement("div");
    target.setAttribute("data-tour", "calendar-view");
    target.getClientRects = () => [{}] as unknown as DOMRectList;
    document.body.appendChild(target);
    render(<OnboardingTour active tourPhase="calendar" onPhaseComplete={vi.fn()} onTourSkip={vi.fn()} />);
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(drive.configs).toHaveLength(1);
    expect(drive.configs[0]!.steps[0]!.element).toBe("[data-tour='calendar-view']");
  });
});
