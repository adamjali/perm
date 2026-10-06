import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CaseLookupForm } from "../CaseLookupForm";

describe("CaseLookupForm", () => {
  it("submits the number to the case page as a plain GET", () => {
    const { container } = render(<CaseLookupForm />);
    const form = container.querySelector("form");
    expect(form?.getAttribute("method")).toBe("get");
    expect(form?.getAttribute("action")).toBe("/perm-case-status");
  });

  it("offers the employer search to someone without the number", () => {
    render(<CaseLookupForm />);
    const link = screen.getByRole("link", { name: /find the case by employer name/i });
    expect(link.getAttribute("href")).toBe("/case-search");
  });
});
