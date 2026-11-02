import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import { SocCodeLink } from "../SocCodeLink";

describe("SocCodeLink", () => {
  it("links a record's code to the job code finder by its seven-character code", () => {
    render(<SocCodeLink code="15-1252.00" />);
    expect(screen.getByRole("link", { name: "15-1252.00" })).toHaveAttribute("href", "/soc-codes?q=15-1252");
  });

  it("prints text that isn't a code as it is, with no link", () => {
    render(<SocCodeLink code="N/A" />);
    expect(screen.getByText("N/A")).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });
});
