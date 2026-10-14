// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../../../test-utils/render-utils";
import AddCaseButton from "../AddCaseButton";

describe("AddCaseButton", () => {
  it("is a link to a new case", () => {
    renderWithProviders(<AddCaseButton />);
    expect(screen.getByRole("link", { name: "Add case" })).toHaveAttribute("href", "/cases/new");
  });
});
