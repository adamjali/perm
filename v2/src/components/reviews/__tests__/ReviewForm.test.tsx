import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ReviewForm } from "../ReviewForm";

describe("ReviewForm's stars", () => {
  it("are five empty stars, each a labelled radio, until one is picked", () => {
    render(<ReviewForm />);
    const stars = screen.getAllByRole("radio");
    expect(stars.map((s) => s.getAttribute("aria-label"))).toEqual(["1 star", "2 stars", "3 stars", "4 stars", "5 stars"]);
    expect(stars.every((s) => !(s as HTMLInputElement).checked)).toBe(true);
    expect(screen.getByText("Pick from 1 to 5 stars")).toBeTruthy();
  });

  it("picks on a click and says the number in words", () => {
    render(<ReviewForm />);
    fireEvent.click(screen.getByLabelText("3 stars"));
    expect((screen.getByLabelText("3 stars") as HTMLInputElement).checked).toBe(true);
    expect(screen.getByText("3 of 5")).toBeTruthy();
  });
});
