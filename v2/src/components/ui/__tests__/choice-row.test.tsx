import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ChoiceRow } from "../choice-row";
import { ChoiceRadios } from "../choice-radios";

const UNITS = [
  { value: "year", label: "per year" },
  { value: "hour", label: "per hour" },
] as const;

function Row({ onChange }: { onChange?: (v: string) => void }) {
  const [unit, setUnit] = useState<"year" | "hour">("year");
  return (
    <form data-testid="form">
      <ChoiceRow
        label="Paid"
        name="unit"
        options={UNITS}
        value={unit}
        onChange={(v) => {
          setUnit(v);
          onChange?.(v);
        }}
      />
    </form>
  );
}

describe("ChoiceRow", () => {
  it("is a group named by its question, with every choice a button and the chosen one pressed", () => {
    // Arrange
    render(<Row />);
    // Act
    const group = screen.getByRole("group", { name: "Paid" });
    // Assert
    expect(group).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "per year" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "per hour" })).toHaveAttribute("aria-pressed", "false");
  });

  it("picks in one tap, draws the pick lime, and sends it with the form under its name", async () => {
    // Arrange
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Row onChange={onChange} />);
    // Act
    await user.click(screen.getByRole("button", { name: "per hour" }));
    // Assert
    const hour = screen.getByRole("button", { name: "per hour" });
    expect(onChange).toHaveBeenCalledWith("hour");
    expect(hour).toHaveAttribute("aria-pressed", "true");
    expect(hour.className).toContain("bg-primary");
    expect(new FormData(screen.getByTestId("form") as HTMLFormElement).get("unit")).toBe("hour");
  });

  it("doesn't report a press on the choice already made", async () => {
    // Arrange
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Row onChange={onChange} />);
    // Act
    await user.click(screen.getByRole("button", { name: "per year" }));
    // Assert
    expect(onChange).not.toHaveBeenCalled();
  });

  it("can name the group for a screen reader without drawing the question", () => {
    // Arrange, Act
    render(<ChoiceRow label="Order" hideLabel options={UNITS} value="year" onChange={() => {}} />);
    // Assert
    expect(screen.getByRole("group", { name: "Order" })).toBeInTheDocument();
    expect(screen.getByText("Order")).toHaveClass("sr-only");
  });
});

describe("ChoiceRadios", () => {
  it("is a fieldset of real radios that a plain form submits, the server's pick checked", async () => {
    // Arrange
    const user = userEvent.setup();
    render(
      <form data-testid="form">
        <ChoiceRadios legend="Approval rate" name="rate" options={[{ value: "", label: "Any" }, { value: "90", label: "90% or more" }]} defaultValue="" />
      </form>,
    );
    const form = screen.getByTestId("form") as HTMLFormElement;
    // Act
    const before = new FormData(form).get("rate");
    await user.click(screen.getByRole("radio", { name: "90% or more" }));
    // Assert
    expect(screen.getByRole("group", { name: "Approval rate" })).toBeInTheDocument();
    expect(before).toBe("");
    expect(new FormData(form).get("rate")).toBe("90");
  });
});
