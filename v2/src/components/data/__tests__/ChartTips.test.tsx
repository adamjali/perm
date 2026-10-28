import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ChartTips } from "../ChartTips";
import { LangProvider } from "@/components/i18n/LangProvider";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ push, replace: vi.fn(), prefetch: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn() }),
}));

beforeEach(() => {
  push.mockReset();
});

function linked() {
  return render(
    <ChartTips label="Decisions per day">
      <div data-tip={"Mon, Sep 28\n712 decided"} data-href="/perm-decision-activity?day=2026-09-28#day" data-testid="a" />
      <div data-tip={"Tue, Sep 29\n989 decided"} data-testid="b" />
    </ChartTips>,
  );
}

function chart() {
  return render(
    <ChartTips label="Decisions per day">
      <div data-tip={"Mon, Sep 28\n712 decided"} data-testid="a" />
      <div data-tip={"Tue, Sep 29\n989 decided"} data-testid="b" />
      <div data-testid="plain" />
    </ChartTips>,
  );
}

const group = () => screen.getByRole("group");
const tip = (container: HTMLElement) => container.querySelector(".chart-tip");

describe("ChartTips", () => {
  it("shows a mark's figures when a mouse moves over it, and hides them on leaving", () => {
    const { container } = chart();
    fireEvent.pointerMove(screen.getByTestId("b"), { pointerType: "mouse" });
    expect(tip(container)?.textContent).toBe("Tue, Sep 29989 decided");
    expect(screen.getByTestId("b").hasAttribute("data-tip-active")).toBe(true);

    fireEvent.pointerMove(screen.getByTestId("plain"), { pointerType: "mouse" });
    expect(tip(container)).toBeNull();
    expect(screen.getByTestId("b").hasAttribute("data-tip-active")).toBe(false);
  });

  it("toggles on tap, and ignores mouse clicks so a click never hides a hovered mark", () => {
    const { container } = chart();
    fireEvent.pointerUp(screen.getByTestId("a"), { pointerType: "touch" });
    expect(tip(container)?.textContent).toContain("712 decided");
    fireEvent.pointerUp(screen.getByTestId("a"), { pointerType: "touch" });
    expect(tip(container)).toBeNull();

    fireEvent.pointerMove(screen.getByTestId("a"), { pointerType: "mouse" });
    fireEvent.pointerUp(screen.getByTestId("a"), { pointerType: "mouse" });
    expect(tip(container)?.textContent).toContain("712 decided");
  });

  it("is one tab stop whose arrow keys step through the marks and read each out", () => {
    const { container } = chart();
    expect(group().getAttribute("tabindex")).toBe("0");
    fireEvent.keyDown(group(), { key: "ArrowRight" });
    expect(tip(container)?.textContent).toContain("712 decided");
    fireEvent.keyDown(group(), { key: "ArrowRight" });
    expect(tip(container)?.textContent).toContain("989 decided");
    expect(screen.getByRole("status").textContent).toBe("Tue, Sep 29, 989 decided");
    fireEvent.keyDown(group(), { key: "ArrowRight" });
    expect(tip(container)?.textContent).toContain("989 decided");
    fireEvent.keyDown(group(), { key: "Home" });
    expect(tip(container)?.textContent).toContain("712 decided");
    fireEvent.keyDown(group(), { key: "Escape" });
    expect(tip(container)).toBeNull();
  });

  it("opens a mark's page on a click, a second tap or Enter, and leaves a mark without one alone", () => {
    const { container } = linked();
    fireEvent.pointerUp(screen.getByTestId("a"), { pointerType: "mouse", button: 0 });
    expect(push).toHaveBeenCalledWith("/perm-decision-activity?day=2026-09-28#day");

    push.mockReset();
    fireEvent.pointerUp(screen.getByTestId("a"), { pointerType: "touch" });
    expect(push).not.toHaveBeenCalled();
    expect(tip(container)?.textContent).toContain("712 decided");
    fireEvent.pointerUp(screen.getByTestId("a"), { pointerType: "touch" });
    expect(push).toHaveBeenCalledTimes(1);

    push.mockReset();
    fireEvent.pointerUp(screen.getByTestId("b"), { pointerType: "mouse", button: 0 });
    fireEvent.pointerUp(screen.getByTestId("b"), { pointerType: "touch" });
    fireEvent.pointerUp(screen.getByTestId("b"), { pointerType: "touch" });
    expect(push).not.toHaveBeenCalled();

    fireEvent.keyDown(group(), { key: "Home" });
    fireEvent.keyDown(group(), { key: "Enter" });
    expect(push).toHaveBeenCalledWith("/perm-decision-activity?day=2026-09-28#day");
  });
});

describe("ChartTips in a translated page", () => {
  it("gives the keyboard hint in the page's language", () => {
    const { container } = render(
      <LangProvider lang="zh">
        <ChartTips label="每天的判定">
          <div data-tip={"9月28日\n712"} />
        </ChartTips>
      </LangProvider>,
    );
    expect(container.querySelector('[role="group"]')?.getAttribute("aria-label")).toBe("每天的判定。用方向键逐个读取数值。");
  });

  it("keeps the English hint with no provider", () => {
    const { container } = chart();
    expect(container.querySelector('[role="group"]')?.getAttribute("aria-label")).toBe(
      "Decisions per day. Use the arrow keys to read each value.",
    );
  });
});
