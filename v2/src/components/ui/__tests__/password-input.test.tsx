import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AuthField } from "@/components/auth/AuthField";
import { PasswordInput } from "../password-input";

/**
 * A password field starts masked, whatever type its caller passes.
 *
 * AuthField defaults `type="text"` and passes it through; PasswordInput used
 * to spread its props after its own `type`, so the caller's "text" won and
 * sign-up and reset showed the password in plain text (Sep 28 2026).
 */
describe("PasswordInput", () => {
  it("starts masked even when the caller passes type=text", () => {
    render(<PasswordInput aria-label="Password" type="text" />);
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
  });

  it("reveals only through its own toggle", () => {
    render(<PasswordInput aria-label="Password" />);
    const input = screen.getByLabelText("Password");
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(input).toHaveAttribute("type", "text");
    fireEvent.click(screen.getByRole("button", { name: "Hide password" }));
    expect(input).toHaveAttribute("type", "password");
  });

  it("is masked inside AuthField, the sign-up and reset field", () => {
    render(
      <AuthField
        id="pw"
        label="Password"
        component="password"
        state="pristine"
        value=""
        onChange={() => {}}
      />,
    );
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
  });
});
