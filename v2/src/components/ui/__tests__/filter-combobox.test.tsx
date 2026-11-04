import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { FilterCombobox, type ComboboxOption } from "../filter-combobox";

const FIRMS: ComboboxOption[] = Array.from({ length: 320 }, (_, i) => ({
  value: `Firm ${String(i + 1).padStart(3, "0")}`,
  label: `Firm ${String(i + 1).padStart(3, "0")} (${320 - i})`,
}));
FIRMS.push({ value: "Fragomen, Del Rey, Bernsen & Loewy LLP", label: "Fragomen, Del Rey, Bernsen & Loewy LLP (9)" });

function Harness({ onChange, initial = "" }: { onChange?: (v: string) => void; initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <form data-testid="form">
      <label htmlFor="firm">Law firm</label>
      <FilterCombobox
        id="firm"
        name="firm"
        noun="law firms"
        emptyLabel={`Any (${FIRMS.length})`}
        options={FIRMS}
        value={value}
        onChange={(v) => {
          setValue(v);
          onChange?.(v);
        }}
      />
    </form>
  );
}

describe("FilterCombobox", () => {
  it("is named by its label and shows the empty row's words until something is chosen", () => {
    // Arrange
    render(<Harness />);
    // Act
    const box = screen.getByRole("combobox", { name: "Law firm" });
    // Assert
    expect(box).toHaveTextContent("Any (321)");
    expect(box).toHaveAttribute("aria-expanded", "false");
  });

  it("opens on a press with the search box focused, and says how many it holds", async () => {
    // Arrange
    const user = userEvent.setup();
    render(<Harness />);
    // Act
    await user.click(screen.getByRole("combobox", { name: "Law firm" }));
    // Assert
    const search = screen.getByRole("combobox", { name: "Find law firms" });
    expect(search).toHaveFocus();
    expect(screen.getByRole("status")).toHaveTextContent("The first 300 of 321 law firms. Type to find the rest.");
    expect(within(screen.getByRole("listbox")).getAllByRole("option")).toHaveLength(301);
  });

  it("finds a name past the first rows by any word in it, and counts the matches", async () => {
    // Arrange
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("combobox", { name: "Law firm" }));
    // Act
    await user.keyboard("loewy");
    // Assert
    const options = within(screen.getByRole("listbox")).getAllByRole("option");
    expect(options.map((o) => o.textContent?.trim())).toEqual([
      "Any (321) (chosen)",
      "Fragomen, Del Rey, Bernsen & Loewy LLP (9)",
    ]);
    expect(screen.getByRole("status")).toHaveTextContent("1 of 321 law firms");
  });

  it("highlights the first match, moves with the arrows, and picks with Enter", async () => {
    // Arrange
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Harness onChange={onChange} />);
    await user.click(screen.getByRole("combobox", { name: "Law firm" }));
    // Act
    await user.keyboard("firm 01");
    const search = screen.getByRole("combobox", { name: "Find law firms" });
    const first = document.getElementById(search.getAttribute("aria-activedescendant")!);
    await user.keyboard("{ArrowDown}{Enter}");
    // Assert
    expect(first).toHaveTextContent("Firm 010");
    expect(onChange).toHaveBeenCalledWith("Firm 011");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Law firm" })).toHaveTextContent("Firm 011 (310)");
  });

  it("jumps to the ends with Home and End", async () => {
    // Arrange
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("combobox", { name: "Law firm" }));
    const search = screen.getByRole("combobox", { name: "Find law firms" });
    // Act
    await user.keyboard("{End}");
    const last = document.getElementById(search.getAttribute("aria-activedescendant")!);
    await user.keyboard("{Home}");
    const top = document.getElementById(search.getAttribute("aria-activedescendant")!);
    // Assert
    expect(last).toHaveTextContent("Firm 300");
    expect(top).toHaveTextContent("Any (321) (chosen)");
  });

  it("closes on Escape without changing the choice, and gives focus back to the box", async () => {
    // Arrange
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Harness onChange={onChange} />);
    const box = screen.getByRole("combobox", { name: "Law firm" });
    await user.click(box);
    // Act
    await user.keyboard("{ArrowDown}{Escape}");
    // Assert
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
    expect(box).toHaveFocus();
  });

  it("opens with a letter typed on the closed box already searched", async () => {
    // Arrange
    const user = userEvent.setup();
    render(<Harness />);
    screen.getByRole("combobox", { name: "Law firm" }).focus();
    // Act
    await user.keyboard("l");
    // Assert
    expect(screen.getByRole("combobox", { name: "Find law firms" })).toHaveValue("l");
  });

  it("says when nothing matches", async () => {
    // Arrange
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("combobox", { name: "Law firm" }));
    // Act
    await user.keyboard("zzzz");
    // Assert
    expect(screen.getByText("No law firms match that. Try fewer letters.")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("0 of 321 law firms");
  });

  it("sends its value with the form under its name, and the empty row clears it", async () => {
    // Arrange
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Harness onChange={onChange} initial="Firm 002" />);
    const form = screen.getByTestId("form") as HTMLFormElement;
    // Act
    const before = new FormData(form).get("firm");
    await user.click(screen.getByRole("combobox", { name: "Law firm" }));
    await user.click(screen.getByRole("option", { name: /^Any \(321\)/ }));
    // Assert
    expect(before).toBe("Firm 002");
    expect(onChange).toHaveBeenCalledWith("");
    expect(new FormData(form).get("firm")).toBe("");
  });

  it("opens on the first row when the chosen option sits past the rows drawn", async () => {
    // Arrange
    const user = userEvent.setup();
    render(<Harness initial="Fragomen, Del Rey, Bernsen & Loewy LLP" />);
    // Act
    await user.click(screen.getByRole("combobox", { name: "Law firm" }));
    // Assert
    const search = screen.getByRole("combobox", { name: "Find law firms" });
    expect(document.getElementById(search.getAttribute("aria-activedescendant")!)).toHaveTextContent("Any (321)");
  });

  it("marks the chosen row and opens on it", async () => {
    // Arrange
    const user = userEvent.setup();
    render(<Harness initial="Firm 005" />);
    // Act
    await user.click(screen.getByRole("combobox", { name: "Law firm" }));
    // Assert
    const search = screen.getByRole("combobox", { name: "Find law firms" });
    expect(document.getElementById(search.getAttribute("aria-activedescendant")!)).toHaveTextContent("Firm 005 (316) (chosen)");
  });
});
