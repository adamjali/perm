// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, act } from "@testing-library/react";

const capture = vi.hoisted(() => vi.fn());
vi.mock("@/lib/analytics", () => ({ analytics: { capture } }));

import { queryShape, hrefGroup, useAlertFormTelemetry } from "../funnelEvents";

describe("queryShape", () => {
  it("names what was typed without keeping it", () => {
    expect(queryShape("")).toBe("empty");
    expect(queryShape("   ")).toBe("empty");
    expect(queryShape("G-100-26254-230507")).toBe("case");
    expect(queryShape("g10026254230507")).toBe("case-undashed");
    expect(queryShape("G 100 26254 230507")).toBe("case-undashed");
    expect(queryShape("P-100-26161-003499")).toBe("case");
    expect(queryShape("IOE0912345678")).toBe("receipt");
    expect(queryShape("2025-11")).toBe("month");
    expect(queryShape("Adobe")).toBe("name");
    expect(queryShape("2025-13")).toBe("name");
  });
});

describe("hrefGroup", () => {
  it("reads the kind of place from the address alone", () => {
    expect(hrefGroup("/perm-case-status?case=G-100-26254-230507")).toBe("case");
    expect(hrefGroup("/tools/perm-timeline-calculator?month=2025-11")).toBe("estimate");
    expect(hrefGroup("/perm-employers/adobe-inc")).toBe("employer");
    expect(hrefGroup("/perm-employers/compare")).toBe("page");
    expect(hrefGroup("/perm-employers/under-review")).toBe("page");
    expect(hrefGroup("/perm-attorneys/fragomen")).toBe("firm");
    expect(hrefGroup("/perm-wages/software-developers")).toBe("job");
    expect(hrefGroup("/case-search?q=adobe")).toBe("all-results");
    expect(hrefGroup("/guides/perm-on-hold")).toBe("article");
    expect(hrefGroup("/perm-processing-times")).toBe("page");
  });
});

describe("useAlertFormTelemetry", () => {
  let observers: { cb: IntersectionObserverCallback; disconnect: () => void }[] = [];
  beforeEach(() => {
    capture.mockClear();
    observers = [];
    class FakeIO {
      cb: IntersectionObserverCallback;
      constructor(cb: IntersectionObserverCallback) {
        this.cb = cb;
        observers.push(this as never);
      }
      observe() {}
      disconnect() {}
    }
    vi.stubGlobal("IntersectionObserver", FakeIO);
  });

  function Form() {
    const t = useAlertFormTelemetry("case", "perm");
    return (
      <form ref={t.observe} onFocusCapture={t.onFocusCapture}>
        <input aria-label="email" />
        <input aria-label="other" />
      </form>
    );
  }

  it("counts the form as seen once and started once, with no address", () => {
    const { getByLabelText } = render(<Form />);
    const seen = () => observers[0]!.cb([{ isIntersecting: true } as IntersectionObserverEntry], {} as never);
    act(seen);
    act(seen);
    fireEvent.focus(getByLabelText("email"));
    fireEvent.focus(getByLabelText("other"));
    expect(capture.mock.calls).toEqual([
      ["alert_form_viewed", { kind: "case", source: "perm" }],
      ["alert_form_started", { kind: "case", source: "perm" }],
    ]);
  });

  it("does not count a form that never came into view", () => {
    render(<Form />);
    act(() => observers[0]!.cb([{ isIntersecting: false } as IntersectionObserverEntry], {} as never));
    expect(capture).not.toHaveBeenCalled();
  });
});
