import { describe, it, expect } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { CharLimit, charLimitMessage } from "../char-limit";

describe("charLimitMessage", () => {
  it("says nothing below 80% of the limit", () => {
    expect(charLimitMessage(0, 100, false)).toBeNull();
    expect(charLimitMessage(79, 100, false)).toBeNull();
  });
  it("counts from 80%", () => {
    expect(charLimitMessage(80, 100, false)).toBe("80 of 100 characters");
    expect(charLimitMessage(4_100, 5_000, false)).toBe("4,100 of 5,000 characters");
  });
  it("says the field is full at the limit", () => {
    expect(charLimitMessage(100, 100, false)).toBe("100 of 100 characters. That's the most this field holds.");
  });
  it("says a paste was cut, only while the field is full", () => {
    expect(charLimitMessage(100, 100, true)).toBe("Your paste was cut at 100 characters, the most this field holds.");
    expect(charLimitMessage(40, 100, true)).toBeNull();
  });
});

function Controlled({ initial = "", max = 10 }: { initial?: string; max?: number }) {
  const [v, setV] = useState(initial);
  return (
    <CharLimit max={max}>
      <textarea aria-label="Notes" value={v} onChange={(e) => setV(e.target.value)} />
    </CharLimit>
  );
}

describe("CharLimit", () => {
  it("sets maxLength on the field", () => {
    render(<Controlled />);
    expect(screen.getByLabelText("Notes")).toHaveAttribute("maxLength", "10");
  });

  it("shows the count from 80% and links it to the field", () => {
    render(<Controlled initial="12345678" />);
    const note = screen.getByText("8 of 10 characters");
    expect(screen.getByLabelText("Notes").getAttribute("aria-describedby")).toContain(note.id);
  });

  it("says when a paste was cut", () => {
    render(<Controlled initial="12345" />);
    const field = screen.getByLabelText("Notes") as HTMLTextAreaElement;
    field.setSelectionRange(5, 5);
    fireEvent.paste(field, { clipboardData: { getData: () => "abcdefghij" } });
    // The browser applies maxLength to the insert; the test applies it by hand.
    fireEvent.change(field, { target: { value: "12345abcde" } });
    expect(screen.getByText(/your paste was cut at 10 characters/i)).toBeInTheDocument();
  });

  it("passes a parent's aria attributes on to the field", () => {
    render(
      <CharLimit max={10} aria-invalid aria-describedby="hint-id">
        <input aria-label="Title" value="" onChange={() => {}} />
      </CharLimit>
    );
    const field = screen.getByLabelText("Title");
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field.getAttribute("aria-describedby")).toContain("hint-id");
  });

  it("tracks an uncontrolled field's length", () => {
    render(
      <CharLimit max={10}>
        <input aria-label="Name" defaultValue="" />
      </CharLimit>
    );
    const field = screen.getByLabelText("Name");
    fireEvent.input(field, { target: { value: "1234567890" } });
    expect(screen.getByText(/that's the most this field holds/i)).toBeInTheDocument();
  });
});
