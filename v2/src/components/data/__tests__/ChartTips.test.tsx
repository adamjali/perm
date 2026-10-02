import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ChartTips } from "../ChartTips";

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
});
