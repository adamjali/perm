import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const nav = vi.hoisted(() => ({ params: new URLSearchParams() }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => nav.params,
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/tools/compare-my-offer",
}));

import { CompareMyOffer } from "../CompareMyOffer";

const OCCUPATIONS = [
  { value: "15-1252", label: "Software Developers", n: 9000 },
  { value: "15-2051", label: "Data Scientists", n: 400 },
];
const STATES = [{ value: "WA", label: "Washington", n: 300 }];

describe("CompareMyOffer", () => {
  beforeEach(() => {
    nav.params = new URLSearchParams();
  });

  it("opens on the occupation a link names, in the code's seven-character form", () => {
    // Arrange
    nav.params = new URLSearchParams("soc=15-2051.00");
    // Act
    render(<CompareMyOffer occupations={OCCUPATIONS} states={STATES} />);
    // Assert
    expect(screen.getByRole("combobox", { name: "Occupation" })).toHaveTextContent("Data Scientists");
  });

  it("ignores a code the tool doesn't list", () => {
    // Arrange
    nav.params = new URLSearchParams("soc=99-9999");
    // Act
    render(<CompareMyOffer occupations={OCCUPATIONS} states={STATES} />);
    // Assert
    expect(screen.getByRole("combobox", { name: "Occupation" })).toHaveTextContent("Choose the occupation");
  });

  it("keeps its button live and, pressed too soon, says what's missing and puts the cursor there", async () => {
    // Arrange
    const user = userEvent.setup();
    render(<CompareMyOffer occupations={OCCUPATIONS} states={STATES} />);
    const place = screen.getByRole("button", { name: "Place my offer" });
    // Act
    await user.click(place);
    // Assert
    expect(place).toBeEnabled();
    expect(screen.getByRole("alert")).toHaveTextContent("Pick the occupation first.");
    expect(screen.getByRole("combobox", { name: "Occupation" })).toHaveFocus();
  });

  it("asks for the offer next, once an occupation is picked", async () => {
    // Arrange
    nav.params = new URLSearchParams("soc=15-1252");
    const user = userEvent.setup();
    render(<CompareMyOffer occupations={OCCUPATIONS} states={STATES} />);
    // Act
    await user.click(screen.getByRole("button", { name: "Place my offer" }));
    // Assert
    expect(screen.getByRole("alert")).toHaveTextContent("Enter the offer as a number");
    expect(screen.getByLabelText("Your offer")).toHaveFocus();
  });

  it("takes the pay period in one tap", async () => {
    // Arrange
    const user = userEvent.setup();
    render(<CompareMyOffer occupations={OCCUPATIONS} states={STATES} />);
    // Act
    await user.click(screen.getByRole("button", { name: "per hour" }));
    // Assert
    expect(screen.getByRole("group", { name: "Paid" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "per hour" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Your offer")).toHaveAttribute("placeholder", "145000");
  });
});
