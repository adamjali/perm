import { useState } from "react";
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { useFormDomSync } from "../useFormDomSync";

function Form() {
  const [email, setEmail] = useState("");
  const ref = useFormDomSync({ email: setEmail });
  return (
    <form ref={ref}>
      <input name="email" aria-label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <button type="submit" disabled={!email.includes("@")}>
        Send
      </button>
    </form>
  );
}

describe("useFormDomSync", () => {
  it("brings a value React never heard about into state, so a gated button wakes up", () => {
    render(<Form />);
    const box = screen.getByLabelText("Email") as HTMLInputElement;
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
    // What an autofill does: set the value through the node (React's tracker
    // sees it, so onChange will treat the next event as no change).
    box.value = "a@b.co";
    fireEvent.input(box);
    expect(screen.getByRole("button", { name: "Send" })).toBeEnabled();
  });

  it("also catches it when the box is left", () => {
    render(<Form />);
    const box = screen.getByLabelText("Email") as HTMLInputElement;
    box.value = "c@d.co";
    fireEvent.focusOut(box);
    expect(screen.getByRole("button", { name: "Send" })).toBeEnabled();
  });

  it("leaves ordinary typing alone", () => {
    render(<Form />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "x@y.co" } });
    expect((screen.getByLabelText("Email") as HTMLInputElement).value).toBe("x@y.co");
    expect(screen.getByRole("button", { name: "Send" })).toBeEnabled();
  });
});
