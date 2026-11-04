import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EadExtensionCalculator } from "../EadExtensionCalculator";

describe("EadExtensionCalculator's category", () => {
  it("prints a long category whole under the select, which a phone cuts at the chevron", () => {
    // Arrange
    render(<EadExtensionCalculator />);
    // Act
    fireEvent.change(screen.getByLabelText("Category on the receipt"), { target: { value: "A08" } });
    // Assert
    expect(screen.getByText("(a)(8) Citizen of Micronesia, Marshall Islands, or Palau", { selector: "span" })).toBeInTheDocument();
  });

  it("prints nothing extra for a short one", () => {
    // Arrange
    const { container } = render(<EadExtensionCalculator />);
    // Act
    fireEvent.change(screen.getByLabelText("Category on the receipt"), { target: { value: "A05" } });
    // Assert
    expect(container.querySelector("[data-selected-in-full]")).toBeNull();
  });
});
