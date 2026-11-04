import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WageLevelsTool } from "../WageLevelsTool";

describe("WageLevelsTool", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("keeps its button live and, pressed too soon, names what's missing and puts the cursor there", () => {
    // Arrange
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}")));
    render(<WageLevelsTool />);
    const go = screen.getByRole("button", { name: "Look up the four levels" });
    // Act
    fireEvent.click(go);
    // Assert
    expect(go).toBeEnabled();
    expect(screen.getByRole("alert")).toHaveTextContent("Type a job title and pick its code, or type the code.");
    expect(screen.getByLabelText("Job title or SOC code")).toHaveFocus();
  });

  it("asks for the state next, once a code is in", () => {
    // Arrange
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}")));
    render(<WageLevelsTool initialSoc="15-1252" />);
    // Act
    fireEvent.click(screen.getByRole("button", { name: "Look up the four levels" }));
    // Assert
    expect(screen.getByRole("alert")).toHaveTextContent("Pick the state the job is in.");
    expect(screen.getByLabelText("State")).toHaveFocus();
  });

  it("picks the wage series in one tap, the current one first and pressed", () => {
    // Arrange
    render(<WageLevelsTool />);
    const row = screen.getByRole("group", { name: "Wage series" });
    const choices = row.querySelectorAll("button");
    // Act
    fireEvent.click(choices[1]!);
    // Assert
    expect(choices).toHaveLength(3);
    expect(choices[0]).toHaveAttribute("aria-pressed", "false");
    expect(choices[1]).toHaveAttribute("aria-pressed", "true");
  });
});
